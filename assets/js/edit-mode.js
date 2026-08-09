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

  function init() {
    var container = document.querySelector('.post-content[data-source-path]');
    if (!container) return;
    var sourcePath = container.getAttribute('data-source-path');
    if (!sourcePath) return;

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
      state.forEach(function (s) {
        var el = s.el;
        el.setAttribute('contenteditable', 'true');
        el.addEventListener('focus', function () { el.classList.add('edit-block-active'); });
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

    function buildToolbar() {
      var bar = document.createElement('div');
      bar.className = 'edit-toolbar';
      var status = document.createElement('span');
      status.className = 'edit-status';
      status.textContent = 'ready';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Save changes';
      btn.addEventListener('click', save);
      bar.appendChild(status);
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
          setStatus(failCount ? (failCount + ' block(s) failed to save (unchanged on disk)') : 'saved ✓');
        })
        .catch(function (err) {
          setStatus('save failed: ' + err.message + ' (is tools/edit_server.py running?)');
        });
    }

    function ready() {
      lockMath();
      enableEditing();
      statusEl = buildToolbar();
      setStatus('ready — click any paragraph to edit');
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
