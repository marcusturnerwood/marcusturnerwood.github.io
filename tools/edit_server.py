"""
Local sidecar server for the dev-only inline draft editor (see assets/js/edit-mode.js).

Run alongside `jekyll serve --drafts`:

    python tools/edit_server.py

It listens on http://localhost:4001 and only does one thing: given a source-relative
path (e.g. "_drafts/how-teams-and-businesses-should-integrate-ai.html") and a list of
{original, updated} string pairs, it finds each `original` substring in that file and
replaces it with `updated`, then writes the file back. Nothing else in the file is
touched, and nothing is written outside _drafts/ or _posts/ inside this repo.

Jekyll's own file watcher (running in the other terminal) picks up the change and
rebuilds automatically; just refresh the browser if you want the fully re-rendered page.

Never runs in production: the front-end only loads/calls this when
jekyll.environment == 'development', which GitHub Pages builds never set.
"""

import html
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ALLOWED_DIRS = ("_drafts", "_posts")
ALLOWED_SUFFIXES = (".html", ".md", ".markdown")
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
        raise ValueError("path must be inside _drafts/ or _posts/")
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
