(function () {
  var mapEl = document.getElementById('places-map');
  if (!mapEl || typeof L === 'undefined') return;

  var EDIT_SERVER = 'http://localhost:4001';
  var editable = mapEl.dataset.editable === 'true';

  var dataEl = document.getElementById('places-data');
  var places = [];
  try {
    places = JSON.parse((dataEl && dataEl.textContent) || '[]') || [];
  } catch (e) {
    places = [];
  }

  var listEl = document.getElementById('places-list');
  var markers = {};

  var map = L.map(mapEl);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  function fitToPlaces() {
    if (places.length === 0) {
      map.setView([20, 0], 2);
      return;
    }
    var bounds = L.latLngBounds(places.map(function (p) { return [p.lat, p.lng]; }));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
  }

  function formatDate(str) {
    if (!str) return '';
    var d = new Date(str + 'T00:00:00');
    if (isNaN(d)) return str;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function popupHtml(place) {
    var html = '<div class="places-popup">';
    html += '<h3 class="places-popup-title">' + escapeHtml(place.title || 'Untitled') + '</h3>';
    if (place.date) html += '<p class="places-popup-date">' + escapeHtml(formatDate(place.date)) + '</p>';
    if (place.note) html += '<p class="places-popup-note">' + escapeHtml(place.note) + '</p>';
    if (place.photos && place.photos.length) {
      html += '<div class="places-popup-photos">';
      place.photos.forEach(function (src) {
        html += '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(place.title || '') + '" loading="lazy">';
      });
      html += '</div>';
    }
    if (editable) {
      html += '<button type="button" class="places-popup-delete" data-delete-place="' + escapeHtml(place.id) + '">Delete pin</button>';
    }
    html += '</div>';
    return html;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function addMarker(place) {
    var marker = L.marker([place.lat, place.lng]).addTo(map).bindPopup(popupHtml(place));
    markers[place.id] = marker;
    return marker;
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    places.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).forEach(function (place) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'places-list-item';
      btn.innerHTML = '<span class="places-list-title">' + escapeHtml(place.title || 'Untitled') + '</span>' +
        (place.date ? '<span class="places-list-date">' + escapeHtml(formatDate(place.date)) + '</span>' : '');
      btn.addEventListener('click', function () {
        map.flyTo([place.lat, place.lng], 10);
        var marker = markers[place.id];
        if (marker) marker.openPopup();
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function render() {
    Object.keys(markers).forEach(function (id) { map.removeLayer(markers[id]); });
    markers = {};
    places.forEach(addMarker);
    renderList();
  }

  render();
  fitToPlaces();

  if (!editable) return;

  // ---- Dev-only: add / delete pins, saved via tools/edit_server.py ----

  var toolbar = document.getElementById('places-toolbar');
  var addToggle = document.getElementById('places-add-toggle');
  var statusEl = document.getElementById('places-status');
  var modal = document.getElementById('place-form-modal');
  var titleInput = document.getElementById('place-form-title');
  var dateInput = document.getElementById('place-form-date');
  var noteInput = document.getElementById('place-form-note');
  var photosInput = document.getElementById('place-form-photos');
  var formStatus = document.getElementById('place-form-status');
  var saveBtn = document.getElementById('place-form-save');
  var cancelBtn = document.getElementById('place-form-cancel');

  var addMode = false;
  var pendingLatLng = null;

  function setAddMode(on) {
    addMode = on;
    mapEl.classList.toggle('places-map--adding', on);
    addToggle.textContent = on ? 'Click the map…' : 'Add pin';
    statusEl.textContent = on ? 'Click anywhere on the map to place a pin.' : '';
  }

  addToggle.addEventListener('click', function () { setAddMode(!addMode); });

  map.on('click', function (e) {
    if (!addMode) return;
    pendingLatLng = e.latlng;
    setAddMode(false);
    openForm();
  });

  function openForm() {
    titleInput.value = '';
    dateInput.value = '';
    noteInput.value = '';
    photosInput.value = '';
    formStatus.textContent = '';
    modal.hidden = false;
    titleInput.focus();
  }

  function closeForm() {
    modal.hidden = true;
    pendingLatLng = null;
  }

  cancelBtn.addEventListener('click', closeForm);
  modal.querySelector('[data-place-form-close]').addEventListener('click', closeForm);

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function uploadPhoto(file) {
    return readFileAsDataUrl(file).then(function (dataUrl) {
      return fetch(EDIT_SERVER + '/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: dataUrl })
      }).then(function (r) { return r.json(); }).then(function (result) {
        if (!result.ok) throw new Error(result.error || 'upload failed');
        return result.path;
      });
    });
  }

  function savePlaces() {
    return fetch(EDIT_SERVER + '/save-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places: places })
    }).then(function (r) { return r.json(); }).then(function (result) {
      if (!result.ok) throw new Error(result.error || 'save failed');
    });
  }

  saveBtn.addEventListener('click', function () {
    if (!pendingLatLng) return;
    var title = titleInput.value.trim();
    if (!title) {
      formStatus.textContent = 'Title is required.';
      return;
    }
    saveBtn.disabled = true;
    formStatus.textContent = 'Uploading photos…';

    var files = Array.prototype.slice.call(photosInput.files || []);
    Promise.all(files.map(uploadPhoto))
      .then(function (photoPaths) {
        var place = {
          id: Date.now().toString(36),
          title: title,
          lat: pendingLatLng.lat,
          lng: pendingLatLng.lng,
          date: dateInput.value || '',
          note: noteInput.value.trim(),
          photos: photoPaths
        };
        places.push(place);
        formStatus.textContent = 'Saving…';
        return savePlaces().then(function () {
          render();
          closeForm();
        });
      })
      .catch(function (err) {
        formStatus.textContent = 'Error: ' + err.message;
      })
      .finally(function () {
        saveBtn.disabled = false;
      });
  });

  document.addEventListener('click', function (e) {
    var delBtn = e.target.closest && e.target.closest('[data-delete-place]');
    if (!delBtn) return;
    var id = delBtn.getAttribute('data-delete-place');
    if (!window.confirm('Delete this pin?')) return;
    places = places.filter(function (p) { return p.id !== id; });
    savePlaces().then(render).catch(function (err) {
      window.alert('Could not delete: ' + err.message);
    });
  });
})();
