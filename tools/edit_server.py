"""
Local sidecar server for the dev-only inline draft editor (see assets/js/edit-mode.js).

Run alongside `jekyll serve --drafts`:

    python tools/edit_server.py

It listens on http://localhost:4001. Its main job: given a source-relative path
(e.g. "_drafts/how-teams-and-businesses-should-integrate-ai.html") and a list of
{original, updated} string pairs, it finds each `original` substring in that file and
replaces it with `updated`, then writes the file back. Nothing else in the file is
touched, and text edits are only written inside _drafts/, _posts/, _projects/, or site/
(the last of these backs standalone pages like About that opt into inline editing via
the `editable-page` layout).

It also backs three other dev-only tools: the card-photo editor (uploads/repositions
a post's thumbnail via /upload-image and /update-front-matter), the places map
(/save-places, overwriting _data/places.json with the pinned locations), and the
drag-and-drop reorder tool on /drafts/ and /series/ (/save-order, rewriting the
`order` or `series_order` front-matter field across a batch of files after a drag).

Jekyll's own file watcher (running in the other terminal) picks up the change and
rebuilds automatically; just refresh the browser if you want the fully re-rendered page.

Never runs in production: the front-end only loads/calls this when
jekyll.environment == 'development', which GitHub Pages builds never set.
"""

import base64
import html
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ALLOWED_DIRS = ("_drafts", "_posts", "_projects", "site")
ALLOWED_SUFFIXES = (".html", ".md", ".markdown")
IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".gif", ".webp")
IMAGES_DIR = REPO_ROOT / "assets" / "images"
PLACES_FILE = REPO_ROOT / "_data" / "places.json"
PORT = 4001

# Characters the browser's HTML parser silently decodes (e.g. "&ndash;" -> "–")
# without re-encoding back on innerHTML serialization. The client sends us that
# decoded text as `original`, which then won't literally appear in a source file
# that still spells it as a named/numeric entity. Match either form.
FUZZY_CHARS = set('&<>"\'') | {chr(c) for c in range(128, 0x10000)}


def build_fuzzy_pattern(original: str):
    parts = []
    for ch in original:
        if ch in FUZZY_CHARS:
            alts = [re.escape(ch)]
            name = html.entities.codepoint2name.get(ord(ch))
            if name:
                alts.append(re.escape("&" + name + ";"))
            alts.append(re.escape("&#%d;" % ord(ch)))
            alts.append(re.escape("&#x%x;" % ord(ch)))
            parts.append("(?:" + "|".join(alts) + ")")
        else:
            parts.append(re.escape(ch))
    return re.compile("".join(parts))


def resolve_safe_path(rel_path: str) -> Path:
    if not rel_path:
        raise ValueError("empty path")
    candidate = (REPO_ROOT / rel_path).resolve()
    try:
        candidate.relative_to(REPO_ROOT)
    except ValueError:
        raise ValueError("path escapes repo root")
    if candidate.suffix.lower() not in ALLOWED_SUFFIXES:
        raise ValueError("unsupported file type: %s" % candidate.suffix)
    if not any(part in ALLOWED_DIRS for part in candidate.relative_to(REPO_ROOT).parts[:1]):
        raise ValueError("path must be inside _drafts/, _posts/, _projects/, or site/")
    if not candidate.is_file():
        raise ValueError("file does not exist: %s" % rel_path)
    return candidate


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/":
            self._json(200, {"ok": True, "message": "edit_server running", "root": str(REPO_ROOT)})
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path == "/update-front-matter":
            self._handle_update_front_matter()
            return
        if self.path == "/upload-image":
            self._handle_upload_image()
            return
        if self.path == "/save-places":
            self._handle_save_places()
            return
        if self.path == "/save-order":
            self._handle_save_order()
            return
        if self.path != "/save":
            self._json(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            rel_path = payload.get("path", "")
            edits = payload.get("edits", [])

            target = resolve_safe_path(rel_path)
            text = target.read_text(encoding="utf-8")

            results = []
            for edit in edits:
                original = edit.get("original", "")
                updated = edit.get("updated", "")
                if not original:
                    results.append(False)
                    continue
                if original in text:
                    text = text.replace(original, updated, 1)
                    results.append(True)
                    continue
                match = build_fuzzy_pattern(original).search(text)
                if match:
                    text = text[:match.start()] + updated + text[match.end():]
                    results.append(True)
                else:
                    results.append(False)

            target.write_text(text, encoding="utf-8")
            self._json(200, {"ok": True, "results": results})
        except Exception as exc:  # noqa: BLE001 - report any failure back to the client
            self._json(400, {"ok": False, "error": str(exc)})

    def _handle_update_front_matter(self):
        # Updates only the `image:` and/or `image_position:` lines inside a post's
        # YAML front matter (used by the card-photo repositioning tool). The body
        # of the file, and every other front matter key, is left byte-for-byte
        # untouched.
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            rel_path = payload.get("path", "")
            image = payload.get("image")
            position = payload.get("position")
            scale = payload.get("scale")

            target = resolve_safe_path(rel_path)
            text = target.read_text(encoding="utf-8")

            if not text.startswith("---"):
                raise ValueError("file has no front matter")
            close_idx = text.index("\n---", 3)
            fm_end = close_idx + len("\n---")
            front = text[:fm_end]
            rest = text[fm_end:]
            lines = front.split("\n")

            def set_field(key, value):
                prefix = key + ":"
                for i, line in enumerate(lines):
                    if line.startswith(prefix):
                        lines[i] = "%s: %s" % (key, value)
                        return
                lines.insert(len(lines) - 1, "%s: %s" % (key, value))

            if image is not None:
                set_field("image", image)
            if position is not None:
                set_field("image_position", json.dumps(position))
            if scale is not None:
                set_field("image_scale", scale)

            target.write_text("\n".join(lines) + rest, encoding="utf-8")
            self._json(200, {"ok": True})
        except Exception as exc:  # noqa: BLE001 - report any failure back to the client
            self._json(400, {"ok": False, "error": str(exc)})

    def _handle_upload_image(self):
        # Saves an uploaded file into assets/images/ under a sanitized filename,
        # picking a non-colliding name rather than overwriting anything, and
        # reports back the site-relative path to use as `image:`.
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            filename = payload.get("filename", "")
            data_url = payload.get("data", "")

            if not filename or not data_url:
                raise ValueError("filename and data are required")

            stem = Path(filename).stem
            suffix = Path(filename).suffix.lower()
            if suffix not in IMAGE_SUFFIXES:
                suffix = ".jpg"
            safe_stem = re.sub(r"[^a-zA-Z0-9\-_]+", "-", stem).strip("-").lower() or "upload"

            IMAGES_DIR.mkdir(parents=True, exist_ok=True)
            candidate = IMAGES_DIR / (safe_stem + suffix)
            n = 1
            while candidate.exists():
                candidate = IMAGES_DIR / ("%s-%d%s" % (safe_stem, n, suffix))
                n += 1

            encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
            binary = base64.b64decode(encoded)
            candidate.write_bytes(binary)

            self._json(200, {"ok": True, "path": "/assets/images/" + candidate.name})
        except Exception as exc:  # noqa: BLE001 - report any failure back to the client
            self._json(400, {"ok": False, "error": str(exc)})

    def _handle_save_places(self):
        # Overwrites _data/places.json wholesale with the array sent by the map
        # page's pin editor (assets/js/map.js). There's only ever one local editor
        # touching this file, so a full-array replace is simpler and safer than
        # trying to patch individual entries in place.
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            places = payload.get("places")
            if not isinstance(places, list):
                raise ValueError("'places' must be a list")

            PLACES_FILE.parent.mkdir(parents=True, exist_ok=True)
            PLACES_FILE.write_text(json.dumps(places, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            self._json(200, {"ok": True})
        except Exception as exc:  # noqa: BLE001 - report any failure back to the client
            self._json(400, {"ok": False, "error": str(exc)})

    def _handle_save_order(self):
        # Rewrites a single front-matter integer field (`order` for the drafts
        # queue, `series_order` for position within a series) across a whole
        # batch of files at once, so a drag-and-drop reorder can renumber
        # every affected file in one request. Used by assets/js/reorder.js.
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            field = payload.get("field", "")
            if field not in ("order", "series_order"):
                raise ValueError("field must be 'order' or 'series_order'")
            items = payload.get("items", [])

            for item in items:
                rel_path = item.get("path", "")
                value = item.get("value")
                if not isinstance(value, int):
                    raise ValueError("value must be an integer for %s" % rel_path)

                target = resolve_safe_path(rel_path)
                text = target.read_text(encoding="utf-8")
                if not text.startswith("---"):
                    raise ValueError("file has no front matter: %s" % rel_path)
                close_idx = text.index("\n---", 3)
                fm_end = close_idx + len("\n---")
                front = text[:fm_end]
                rest = text[fm_end:]
                lines = front.split("\n")

                prefix = field + ":"
                for i, line in enumerate(lines):
                    if line.startswith(prefix):
                        lines[i] = "%s: %d" % (field, value)
                        break
                else:
                    lines.insert(len(lines) - 1, "%s: %d" % (field, value))

                target.write_text("\n".join(lines) + rest, encoding="utf-8")

            self._json(200, {"ok": True})
        except Exception as exc:  # noqa: BLE001 - report any failure back to the client
            self._json(400, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        print("[edit_server]", fmt % args)


def main():
    server = ThreadingHTTPServer(("localhost", PORT), Handler)
    print("edit_server listening on http://localhost:%d (repo root: %s)" % (PORT, REPO_ROOT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
