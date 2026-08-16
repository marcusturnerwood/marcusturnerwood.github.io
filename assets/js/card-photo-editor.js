(function () {
  var EDIT_SERVER = 'http://localhost:4001';

  var modal = document.getElementById('card-photo-modal');
  if (!modal) return;

  var frame = document.getElementById('card-photo-frame');
  var preview = document.getElementById('card-photo-preview');
  var zoomInput = document.getElementById('card-photo-zoom');
  var uploadInput = document.getElementById('card-photo-upload');
  var pathInput = document.getElementById('card-photo-path');
  var statusEl = document.getElementById('card-photo-status');
  var saveBtn = document.getElementById('card-photo-save');
  var cancelBtn = document.getElementById('card-photo-cancel');

  var activeButton = null;
  var pos = { x: 50, y: 50 };
  var scale = 1;
  var minScale = 1;
  var dragging = false;
  var dragStart = null;
  var pendingUpload = null; // { filename, dataUrl } when a new file has been chosen but not yet saved

  function parsePosition(str) {
    var parts = (str || '50% 50%').trim().split(/\s+/);
    var x = parseFloat(parts[0]) || 50;
    var y = parseFloat(parts[1]) || 50;
    return { x: x, y: y };
  }

  // The lower bound of "zoomed out" isn't 1 (object-fit: cover's own crop) — it's
  // whatever scale, applied on top of that crop, makes the *whole* image visible
  // (i.e. matches object-fit: contain). Below 1 the image is smaller than the box,
  // letterboxed; the min zoom should be that fully-uncropped state, not the crop
  // the browser already forces on you.
  function computeMinScale() {
    var iw = preview.naturalWidth, ih = preview.naturalHeight;
    var rect = frame.getBoundingClientRect();
    if (!iw || !ih || !rect.width || !rect.height) return 1;
    var coverScale = Math.max(rect.width / iw, rect.height / ih);
    var containScale = Math.min(rect.width / iw, rect.height / ih);
    return containScale / coverScale;
  }

  function render() {
    var min = parseFloat(zoomInput.min) || 0.05;
    var max = parseFloat(zoomInput.max) || 3;
    scale = Math.max(min, Math.min(max, scale));
    preview.style.objectPosition = pos.x + '% ' + pos.y + '%';
    preview.style.transform = 'scale(' + scale + ')';
    zoomInput.value = scale;
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function open(button) {
    activeButton = button;
    pendingUpload = null;
    uploadInput.value = '';

    var savedPosition = button.getAttribute('data-position') || '50% 50%';
    var savedScale = button.getAttribute('data-scale') || '1';
    // "1" (bare) only ever comes from the Liquid `| default: 1` fallback, meaning
    // this photo has never actually been saved through the editor; the editor's own
    // saves always write two-decimal values ("1.00"), so this reliably distinguishes
    // "never touched" from "deliberately set to 1".
    var neverCustomized = savedPosition === '50% 50%' && savedScale === '1';

    pos = parsePosition(savedPosition);
    scale = parseFloat(savedScale) || 1;

    // Match the editing frame's shape to this card's actual on-screen thumbnail box,
    // so what you drag/zoom in the modal is a true WYSIWYG preview rather than a
    // guessed 4:3 box (the real card thumbnail's height stretches to match its
    // card's text content, it isn't reliably 4:3).
    var li = button.closest('.post-card');
    var thumb = li && li.querySelector('.post-card-thumb');
    if (thumb) {
      var rect = thumb.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        frame.style.aspectRatio = rect.width + ' / ' + rect.height;
      }
    }

    function onImageReady() {
      minScale = computeMinScale();
      zoomInput.min = minScale.toFixed(3);
      if (neverCustomized) scale = minScale;
      render();
    }
    preview.onload = onImageReady;
    preview.src = button.getAttribute('data-image');
    if (preview.complete && preview.naturalWidth) onImageReady();

    render();
    pathInput.value = button.getAttribute('data-image') || '';
    pathInput.disabled = false;
    setStatus('');
    modal.hidden = false;
    document.body.classList.add('card-photo-open');
  }

  function close() {
    modal.hidden = true;
    activeButton = null;
    document.body.classList.remove('card-photo-open');
  }

  // ---- Drag to reposition ----
  // Pointer Events + setPointerCapture where available, but move/up listeners live
  // on document too so dragging still tracks correctly even if capture fails or the
  // cursor leaves the frame mid-drag.
  function startDrag(e) {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    if (frame.setPointerCapture) {
      try { frame.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    e.preventDefault();
  }

  function moveDrag(e) {
    if (!dragging) return;
    var rect = frame.getBoundingClientRect();
    var dx = ((e.clientX - dragStart.x) / rect.width) * 100;
    var dy = ((e.clientY - dragStart.y) / rect.height) * 100;
    pos.x = Math.max(0, Math.min(100, dragStart.posX - dx));
    pos.y = Math.max(0, Math.min(100, dragStart.posY - dy));
    render();
    e.preventDefault();
  }

  function endDrag(e) {
    dragging = false;
    if (e && e.pointerId !== undefined && frame.hasPointerCapture && frame.hasPointerCapture(e.pointerId)) {
      try { frame.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  }

  frame.addEventListener('pointerdown', startDrag);
  frame.addEventListener('mousedown', startDrag);
  document.addEventListener('pointermove', moveDrag);
  document.addEventListener('mousemove', moveDrag);
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('mouseup', endDrag);
  frame.addEventListener('pointercancel', endDrag);

  var panel = modal.querySelector('.card-photo-modal-panel');
  panel.addEventListener('wheel', function (e) {
    e.preventDefault();
    var delta = e.deltaY < 0 ? 0.08 : -0.08;
    scale = scale + delta;
    render();
  }, { passive: false });

  zoomInput.addEventListener('input', function () {
    scale = parseFloat(zoomInput.value) || minScale;
    render();
  });

  // ---- Change the photo ----
  uploadInput.addEventListener('change', function () {
    var file = uploadInput.files && uploadInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      pendingUpload = { filename: file.name, dataUrl: reader.result };
      pos = { x: 50, y: 50 };
      preview.onload = function () {
        minScale = computeMinScale();
        zoomInput.min = minScale.toFixed(3);
        scale = minScale;
        render();
      };
      preview.src = reader.result;
      pathInput.value = file.name + ' (will be uploaded on save)';
      pathInput.disabled = true;
    };
    reader.readAsDataURL(file);
  });

  pathInput.addEventListener('input', function () {
    if (pathInput.disabled) return;
    preview.src = pathInput.value;
  });

  function finishSave(sourcePath, imagePath, position, scaleValue) {
    fetch(EDIT_SERVER + '/update-front-matter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: sourcePath, image: imagePath, position: position, scale: scaleValue })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          setStatus('save failed: ' + (data.error || 'unknown error'));
          return;
        }
        activeButton.setAttribute('data-image', imagePath);
        activeButton.setAttribute('data-position', position);
        activeButton.setAttribute('data-scale', scaleValue);
        var li = activeButton.closest('.post-card');
        if (li) {
          var img = li.querySelector('.post-card-thumb img');
          if (img) {
            img.src = imagePath;
            img.style.objectPosition = position;
            img.style.transform = 'scale(' + scaleValue + ')';
          }
        }
        setStatus('saved ✓');
        setTimeout(close, 500);
      })
      .catch(function (err) {
        setStatus('save failed: ' + err.message + ' (is tools/edit_server.py running?)');
      });
  }

  function save() {
    if (!activeButton) return;
    var sourcePath = activeButton.getAttribute('data-source-path');
    var position = pos.x.toFixed(1) + '% ' + pos.y.toFixed(1) + '%';
    var scaleValue = scale.toFixed(2);

    if (pendingUpload) {
      setStatus('uploading…');
      fetch(EDIT_SERVER + '/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: pendingUpload.filename, data: pendingUpload.dataUrl })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) {
            setStatus('upload failed: ' + (data.error || 'unknown error'));
            return;
          }
          setStatus('saving…');
          finishSave(sourcePath, data.path, position, scaleValue);
        })
        .catch(function (err) {
          setStatus('upload failed: ' + err.message + ' (is tools/edit_server.py running?)');
        });
      return;
    }

    var image = pathInput.value.trim();
    setStatus('saving…');
    finishSave(sourcePath, image, position, scaleValue);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.post-card-photo-edit');
    if (btn) {
      e.preventDefault();
      open(btn);
    }
  });

  cancelBtn.addEventListener('click', close);
  modal.querySelector('[data-photo-close]').addEventListener('click', close);
  saveBtn.addEventListener('click', save);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
})();
