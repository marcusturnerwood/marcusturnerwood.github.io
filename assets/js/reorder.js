(function () {
  var EDIT_SERVER = 'http://localhost:4001';

  Array.prototype.slice.call(document.querySelectorAll('[data-orderable]')).forEach(function (container) {
    var field = container.dataset.orderField;
    var statusEl = document.getElementById(container.dataset.statusFor || '');
    var dragEl = null;

    function itemsInGroup(group) {
      var all = Array.prototype.slice.call(container.querySelectorAll('.draggable-item'));
      if (group == null) return all;
      return all.filter(function (el) { return (el.dataset.group || null) === group; });
    }

    container.addEventListener('dragstart', function (e) {
      var item = e.target.closest('.draggable-item');
      if (!item) return;
      dragEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Firefox requires data to be set for drag to start at all.
      e.dataTransfer.setData('text/plain', item.dataset.sourcePath || '');
    });

    container.addEventListener('dragend', function (e) {
      var item = e.target.closest('.draggable-item');
      if (!item) return;
      item.classList.remove('dragging');
      persist(item.dataset.group || null);
      dragEl = null;
    });

    container.addEventListener('dragover', function (e) {
      if (!dragEl) return;
      e.preventDefault();
      var group = dragEl.dataset.group || null;
      var siblings = itemsInGroup(group).filter(function (el) { return el !== dragEl; });
      var after = null;
      var closestOffset = -Infinity;
      siblings.forEach(function (el) {
        var box = el.getBoundingClientRect();
        var offset = e.clientY - box.top - box.height / 2;
        if (offset < 0 && offset > closestOffset) {
          closestOffset = offset;
          after = el;
        }
      });
      if (after) {
        after.parentNode.insertBefore(dragEl, after);
      } else {
        var groupItems = itemsInGroup(group).filter(function (el) { return el !== dragEl; });
        var last = groupItems[groupItems.length - 1];
        if (last) {
          last.parentNode.insertBefore(dragEl, last.nextSibling);
        }
      }
    });

    function persist(group) {
      var items = itemsInGroup(group).map(function (el, i) {
        return { path: el.dataset.sourcePath, value: i };
      });
      if (statusEl) statusEl.textContent = 'Saving order…';
      fetch(EDIT_SERVER + '/save-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: field, items: items })
      }).then(function (r) { return r.json(); }).then(function (result) {
        if (!statusEl) return;
        statusEl.textContent = result.ok ? 'Order saved.' : 'Error: ' + (result.error || 'save failed');
        if (result.ok) setTimeout(function () { statusEl.textContent = ''; }, 1500);
      }).catch(function (err) {
        if (statusEl) statusEl.textContent = 'Error: ' + err.message + ' (is tools/edit_server.py running?)';
      });
    }
  });
})();
