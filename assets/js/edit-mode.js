// Dev-only inline text editor. See _includes/edit-mode.html for how this is loaded
// (gated to jekyll.environment == 'development', never shipped to production).
//
// Prose blocks (p, li, headings, etc.) become directly editable in the rendered page.
// MathJax-rendered equations inside them are locked as atomic, non-editable islands
// so typing can't corrupt the underlying TeX. Enter splits the current block into a
// new paragraph at the cursor (like a normal editor); Shift+Enter inserts a soft line
// break within the same block instead. A focused block can also be requoted to a
// different heading level via the toolbar's tag selector. "Save" posts the changed/
// new/retagged blocks to a local sidecar server (tools/edit_server.py) which splices
// them back into the source .html file on disk; everything else in the file is left
// untouched.
(function () {
  var EDIT_SERVER = 'http://localhost:4001';
  var TARGET_SELECTOR = 'p, li, h2, h3, h4, figcaption, dd, dt, blockquote, td, th';
  var MATH_RE = /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g;
  // Tags a block can be requoted to via the toolbar. LI/TD/TH/DT/DD/FIGCAPTION/
  // BLOCKQUOTE keep structural meaning tied to their parent (a list item, a table
  // cell, a caption) that a heading/paragraph swap would break, so those are left
  // out — only the free-standing prose tags are offered.
  var RETAG_OPTIONS = ['P', 'H2', 'H3', 'H4'];

  // Phosphor Icons (phosphoricons.com), regular style, MIT licensed.
  var ICON_MAP_PIN = 'M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z';
  var ICON_CHECK = 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';

  function icon(pathD, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 256 256');
    svg.setAttribute('width', size || 14);
    svg.setAttribute('height', size || 14);
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);
    return svg;
  }

  function init() {
    var container = document.querySelector('.post-content[data-source-path]');
    if (!container) return;
    var sourcePath = container.getAttribute('data-source-path');
    if (!sourcePath) return;

    var BOOKMARK_KEY = 'edit-bookmark:' + sourcePath;

    var rawScript = document.getElementById('post-content-raw');
    if (!rawScript) return;
    var rawDiv = document.createElement('div');
    // Reverse the "</script" -> "<\/script" escaping applied server-side to stop
    // a nested widget <script> tag from terminating this raw-text block early.
    rawDiv.innerHTML = rawScript.textContent.replace(/<\\\/script/gi, '</script');

    // Interactive widgets can inject their own p/li/etc at runtime (e.g. a
    // rendered answer) that never existed in the source HTML, which would
    // otherwise desync the live/raw block counts below. Their content is
    // data-driven, not hand-authored prose, so it isn't meant to be
    // text-edited here regardless — exclude it from both sides.
    function notInWidget(el) { return !el.closest('.interactive-widget'); }

    var liveBlocks = Array.prototype.slice.call(container.querySelectorAll(TARGET_SELECTOR)).filter(notInWidget);
    var rawBlocks = Array.prototype.slice.call(rawDiv.querySelectorAll(TARGET_SELECTOR)).filter(notInWidget);

    if (liveBlocks.length !== rawBlocks.length) {
      console.warn('[edit-mode] live/raw block count mismatch (' + liveBlocks.length + ' vs ' + rawBlocks.length + '); edit mode disabled for this page.');
      return;
    }

    // Each entry tracks one block. `original`/`originalOuter` are only ever set
    // for blocks that actually exist in the source file (i.e. not ones created
    // in-browser via Enter) — those are what save() diffs against.
    var state = liveBlocks.map(function (el, i) {
      return {
        el: el,
        tag: el.tagName,
        original: rawBlocks[i].innerHTML,
        originalOuter: rawBlocks[i].outerHTML,
        texList: rawBlocks[i].textContent.match(MATH_RE) || [],
        dirty: false,
        isNew: false,
        insertAfterIndex: null,
        tagChanged: false
      };
    });

    var statusEl;
    var retagSelect;
    var lastFocusedIndex = -1;

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text;
    }

    function lockMath(s) {
      var mjxNodes = Array.prototype.slice.call(s.el.querySelectorAll('mjx-container'));
      mjxNodes.forEach(function (node, idx) {
        node.setAttribute('contenteditable', 'false');
        if (s.texList[idx] !== undefined) node.setAttribute('data-tex', s.texList[idx]);
      });
    }

    function serialize(s) {
      var clone = s.el.cloneNode(true);
      var locked = Array.prototype.slice.call(clone.querySelectorAll('mjx-container[data-tex]'));
      locked.forEach(function (node) {
        node.replaceWith(document.createTextNode(node.getAttribute('data-tex')));
      });
      return clone.innerHTML;
    }

    // Reconstructs a block's current outer HTML from its live content, in the
    // same "<tag>\n    ...\n  </tag>" shape the rest of this codebase's source
    // files already use, so a spliced-in new paragraph or a retagged heading
    // reads as a normal hand-written block rather than a single dense line.
    function buildOuter(s) {
      var tag = s.tag.toLowerCase();
      return '<' + tag + '>\n    ' + serialize(s) + '\n  </' + tag + '>';
    }

    function markDirty(s) {
      s.dirty = true;
      s.el.classList.add('edit-block-dirty');
      setStatus('unsaved changes');
    }

    function updateRetagControl() {
      if (!retagSelect) return;
      var s = state[lastFocusedIndex];
      var canRetag = s && RETAG_OPTIONS.indexOf(s.tag) !== -1;
      retagSelect.disabled = !canRetag;
      retagSelect.value = canRetag ? s.tag : 'P';
    }

    // ---- Splitting a block into two on Enter ----

    function insertLineBreak() {
      if (document.queryCommandSupported && document.queryCommandSupported('insertLineBreak')) {
        document.execCommand('insertLineBreak');
      } else {
        var sel = window.getSelection();
        if (!sel.rangeCount) return;
        var range = sel.getRangeAt(0);
        range.deleteContents();
        var br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    function splitBlockAtCursor(index) {
      var s = state[index];
      var sel = window.getSelection();
      if (!sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      if (!s.el.contains(range.startContainer)) return;

      range.deleteContents();
      var tailRange = range.cloneRange();
      tailRange.selectNodeContents(s.el);
      tailRange.setStart(range.endContainer, range.endOffset);
      var tailFragment = tailRange.extractContents();

      var newEl = document.createElement(s.el.tagName);
      newEl.appendChild(tailFragment);
      // An entirely empty split-off block collapses to zero height and can't
      // be clicked back into — give it the same placeholder a brand new
      // paragraph gets.
      if (!newEl.textContent.trim() && !newEl.querySelector('mjx-container')) {
        newEl.innerHTML = '';
      }
      s.el.parentNode.insertBefore(newEl, s.el.nextSibling);

      var newState = {
        el: newEl,
        tag: s.tag,
        original: null,
        originalOuter: null,
        texList: [],
        dirty: true,
        isNew: true,
        insertAfterIndex: index,
        tagChanged: false
      };
      state.splice(index + 1, 0, newState);
      // Every isNew block downstream still points at the correct anchor by
      // index, but any *plain* index-based lookups after this point must use
      // the spliced array, not the original — enableEditingFor closes over
      // `newState`/`state` directly rather than a captured index, so this is
      // safe.
      wireBlock(newState);
      markDirty(s);

      newEl.focus();
      var caretRange = document.createRange();
      caretRange.setStart(newEl, 0);
      caretRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caretRange);
    }

    // ---- Per-block wiring ----

    function wireBlock(s) {
      var el = s.el;
      el.setAttribute('contenteditable', 'true');
      el.addEventListener('focus', function () {
        el.classList.add('edit-block-active');
        lastFocusedIndex = state.indexOf(s);
        updateRetagControl();
      });
      el.addEventListener('blur', function () { el.classList.remove('edit-block-active'); });
      el.addEventListener('input', function () { markDirty(s); });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (e.shiftKey) {
          insertLineBreak();
          markDirty(s);
        } else {
          splitBlockAtCursor(state.indexOf(s));
        }
      });
      el.addEventListener('paste', function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text/plain');
        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
          document.execCommand('insertText', false, text);
        } else {
          document.getSelection().getRangeAt(0).insertNode(document.createTextNode(text));
        }
      });
    }

    function enableEditing() {
      state.forEach(function (s) {
        lockMath(s);
        wireBlock(s);
      });
    }

    // ---- Change the focused block's heading level ----

    function retagFocused(newTag) {
      var s = state[lastFocusedIndex];
      if (!s || RETAG_OPTIONS.indexOf(s.tag) === -1) return;
      if (s.tag === newTag) return;
      var newEl = document.createElement(newTag);
      newEl.setAttribute('contenteditable', 'true');
      while (s.el.firstChild) newEl.appendChild(s.el.firstChild);
      s.el.parentNode.replaceChild(newEl, s.el);
      s.el = newEl;
      s.tag = newTag;
      s.tagChanged = true;
      wireBlock(s);
      markDirty(s);
      newEl.focus();
    }

    function toggleBookmark() {
      var idx = lastFocusedIndex;
      if (idx === -1 || !state[idx]) {
        setStatus('click into a block first');
        return;
      }
      var already = state[idx].el.classList.contains('edit-block-bookmark');
      state.forEach(function (s) { s.el.classList.remove('edit-block-bookmark'); });
      if (already) {
        try { localStorage.removeItem(BOOKMARK_KEY); } catch (e) {}
        setStatus('');
      } else {
        state[idx].el.classList.add('edit-block-bookmark');
        try { localStorage.setItem(BOOKMARK_KEY, String(idx)); } catch (e) {}
        setStatus('bookmark set — up to here');
      }
    }

    function applyStoredBookmark() {
      var stored;
      try { stored = localStorage.getItem(BOOKMARK_KEY); } catch (e) { return; }
      if (stored === null) return;
      var idx = parseInt(stored, 10);
      if (isNaN(idx) || idx < 0 || idx >= state.length) return;
      state[idx].el.classList.add('edit-block-bookmark');
      setTimeout(function () {
        state[idx].el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 300);
    }

    function buildToolbar() {
      var bar = document.createElement('div');
      bar.className = 'edit-toolbar';
      var status = document.createElement('span');
      status.className = 'edit-status';
      status.textContent = 'ready';

      var select = document.createElement('select');
      select.className = 'edit-retag-select';
      select.title = 'Change the focused block’s heading level';
      select.setAttribute('aria-label', 'Change the focused block’s heading level');
      var labels = { P: 'Paragraph', H2: 'Heading 2', H3: 'Heading 3', H4: 'Heading 4' };
      RETAG_OPTIONS.forEach(function (tag) {
        var opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = labels[tag];
        select.appendChild(opt);
      });
      select.disabled = true;
      select.addEventListener('change', function () { retagFocused(select.value); });
      retagSelect = select;

      var markBtn = document.createElement('button');
      markBtn.type = 'button';
      markBtn.className = 'edit-mark-btn';
      markBtn.appendChild(icon(ICON_MAP_PIN, 14));
      markBtn.title = 'Mark place';
      markBtn.setAttribute('aria-label', 'Mark place');
      markBtn.addEventListener('click', toggleBookmark);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Save changes';
      btn.addEventListener('click', save);

      bar.appendChild(status);
      bar.appendChild(select);
      bar.appendChild(markBtn);
      bar.appendChild(btn);
      document.body.appendChild(bar);
      document.body.classList.add('has-edit-toolbar');
      return status;
    }

    // ---- Save: turn the current state into a flat list of {original, updated}
    // text replacements the server can apply as plain substring splices. ----

    function save() {
      var edits = [];
      var handledAsOuter = {}; // state-array index -> true once its own edit is folded into an outer-html diff

      // Blocks whose own tag changed: diff their full outer HTML so the tag
      // name itself is part of the replacement, not just the inner text.
      state.forEach(function (s, i) {
        if (s.isNew || !s.tagChanged) return;
        edits.push({ original: s.originalOuter, updated: buildOuter(s) });
        handledAsOuter[i] = true;
      });

      // New blocks (from Enter): fold each into an outer-html diff on the
      // *existing* block it was split from, appending after whatever that
      // anchor's own current content is. Multiple new blocks chained off the
      // same anchor (e.g. pressing Enter twice) accumulate onto one another
      // in order, so the whole run lands as a single ordered replacement.
      var anchorAccum = {};
      state.forEach(function (s) {
        if (!s.isNew) return;
        var idx = s.insertAfterIndex;
        var anchor = state[idx];
        if (!anchor || anchor.originalOuter == null) return; // anchor must be a real source block
        var acc = anchorAccum[idx];
        if (!acc) {
          var baseUpdated = handledAsOuter[idx] || anchor.dirty ? buildOuter(anchor) : anchor.originalOuter;
          acc = anchorAccum[idx] = { original: anchor.originalOuter, updated: baseUpdated };
          handledAsOuter[idx] = true;
        }
        acc.updated += '\n\n  ' + buildOuter(s);
      });
      Object.keys(anchorAccum).forEach(function (idx) { edits.push(anchorAccum[idx]); });

      // A tag change or an Enter-split shifts block boundaries in the source
      // file in a way the in-memory `state` array can't safely patch itself —
      // those cases need a reload afterwards to re-derive `state` from the
      // file. A plain text edit to an existing block doesn't move any
      // boundaries, so it can be resynced in place instead (see below).
      var structural = Object.keys(handledAsOuter).length > 0;

      // Everything else: the original simple case, an inner-html-only diff.
      var simpleEditIndices = [];
      state.forEach(function (s, i) {
        if (s.isNew || handledAsOuter[i]) return;
        var updated = serialize(s);
        if (updated !== s.original) {
          edits.push({ original: s.original, updated: updated });
          simpleEditIndices.push(i);
        }
      });

      if (edits.length === 0) {
        setStatus('nothing to save');
        return;
      }
      setStatus('saving…');
      fetch(EDIT_SERVER + '/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: sourcePath, edits: edits })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) {
            setStatus('save failed: ' + (data.error || 'unknown error'));
            return;
          }
          var failCount = 0;
          (data.results || []).forEach(function (ok) { if (!ok) failCount++; });
          if (failCount) {
            // A partial failure still writes whatever DID match, so `state`
            // for the blocks that succeeded in this same batch would
            // otherwise be left stale too (their `original` never gets
            // updated below) — every later save touching any of them would
            // then keep failing the same way, compounding indefinitely.
            // Reloading is the only way to get every block back in sync
            // with what's actually on disk now, same as a structural save.
            setStatus(failCount + ' block(s) failed to save (unchanged on disk) — reloading…');
            setTimeout(function () { window.location.reload(); }, 1400);
            return;
          }
          if (structural) {
            setStatus('saved, reloading…');
            setTimeout(function () { window.location.reload(); }, 400);
            return;
          }
          // No split or retag in this save, so every block that was sent
          // still corresponds 1:1 with its `state` entry — resync `original`/
          // `originalOuter` from what was just written and keep editing, the
          // same way saves worked before splits/retags existed. No reload
          // means no window where a concurrent external edit (or another
          // save fired before this one's reload lands) can make the next
          // save's snapshot go stale.
          simpleEditIndices.forEach(function (i, j) {
            var s = state[i];
            s.original = edits[j].updated;
            s.originalOuter = buildOuter(s);
            s.dirty = false;
            s.el.classList.remove('edit-block-dirty');
          });
          setStatus('saved ');
          if (statusEl) statusEl.appendChild(icon(ICON_CHECK, 12));
        })
        .catch(function (err) {
          setStatus('save failed: ' + err.message + ' (is tools/edit_server.py running?)');
        });
    }

    function ready() {
      enableEditing();
      statusEl = buildToolbar();
      setStatus('');
      applyStoredBookmark();
    }

    if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
      window.MathJax.startup.promise.then(ready, ready);
    } else {
      setTimeout(ready, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
