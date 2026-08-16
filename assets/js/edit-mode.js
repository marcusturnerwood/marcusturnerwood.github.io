// Dev-only inline text editor. See _includes/edit-mode.html for how this is loaded
// (gated to jekyll.environment == 'development', never shipped to production).
//
// Prose blocks (p, li, headings, etc.) become directly editable in the rendered page.
// MathJax-rendered equations inside them are locked as atomic, non-editable islands
// so typing can't corrupt the underlying TeX. "Save" posts only the changed blocks to
// a local sidecar server (tools/edit_server.py) which splices the new text back into
// the source .html file on disk; everything else in the file is left untouched.
(function () {
  var EDIT_SERVER = 'http://localhost:4001';
  var TARGET_SELECTOR = 'p, li, h2, h3, h4, figcaption, dd, dt, blockquote, td, th';
  var MATH_RE = /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g;

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
    rawDiv.innerHTML = rawScript.textContent;

    var liveBlocks = Array.prototype.slice.call(container.querySelectorAll(TARGET_SELECTOR));
    var rawBlocks = Array.prototype.slice.call(rawDiv.querySelectorAll(TARGET_SELECTOR));

    if (liveBlocks.length !== rawBlocks.length) {
      console.warn('[edit-mode] live/raw block count mismatch (' + liveBlocks.length + ' vs ' + rawBlocks.length + '); edit mode disabled for this page.');
      return;
    }

    var state = liveBlocks.map(function (el, i) {
      return {
        el: el,
        original: rawBlocks[i].innerHTML,
        texList: rawBlocks[i].textContent.match(MATH_RE) || [],
        dirty: false
      };
    });

    var statusEl;
    var lastFocusedIndex = -1;

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text;
    }

    function lockMath() {
      state.forEach(function (s) {
        var mjxNodes = Array.prototype.slice.call(s.el.querySelectorAll('mjx-container'));
        mjxNodes.forEach(function (node, idx) {
          node.setAttribute('contenteditable', 'false');
          if (s.texList[idx] !== undefined) node.setAttribute('data-tex', s.texList[idx]);
        });
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

    function enableEditing() {
      state.forEach(function (s, i) {
        var el = s.el;
        el.setAttribute('contenteditable', 'true');
        el.addEventListener('focus', function () {
          el.classList.add('edit-block-active');
          lastFocusedIndex = i;
        });
        el.addEventListener('blur', function () { el.classList.remove('edit-block-active'); });
        el.addEventListener('input', function () {
          s.dirty = true;
          el.classList.add('edit-block-dirty');
          setStatus('unsaved changes');
        });
        el.addEventListener('keydown', function (e) {
          // Text-only edits: no new paragraphs/line breaks.
          if (e.key === 'Enter') e.preventDefault();
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
      });
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
      bar.appendChild(markBtn);
      bar.appendChild(btn);
      document.body.appendChild(bar);
      return status;
    }

    function save() {
      var changes = [];
      state.forEach(function (s, i) {
        var updated = serialize(s);
        if (updated !== s.original) {
          changes.push({ index: i, original: s.original, updated: updated });
        }
      });
      if (changes.length === 0) {
        setStatus('nothing to save');
        return;
      }
      setStatus('saving…');
      fetch(EDIT_SERVER + '/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: sourcePath,
          edits: changes.map(function (c) { return { original: c.original, updated: c.updated }; })
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) {
            setStatus('save failed: ' + (data.error || 'unknown error'));
            return;
          }
          var failCount = 0;
          changes.forEach(function (c, j) {
            if (data.results && data.results[j]) {
              state[c.index].original = c.updated;
              state[c.index].dirty = false;
              state[c.index].el.classList.remove('edit-block-dirty');
            } else {
              failCount++;
            }
          });
          if (failCount) {
            setStatus(failCount + ' block(s) failed to save (unchanged on disk)');
          } else {
            statusEl.textContent = 'saved ';
            statusEl.appendChild(icon(ICON_CHECK, 12));
          }
        })
        .catch(function (err) {
          setStatus('save failed: ' + err.message + ' (is tools/edit_server.py running?)');
        });
    }

    function ready() {
      lockMath();
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
