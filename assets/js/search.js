(function () {
  var toggle = document.getElementById('search-toggle');
  var modal = document.getElementById('search-modal');
  if (!toggle || !modal) return;

  var input = modal.querySelector('.search-input');
  var resultsEl = modal.querySelector('.search-results');
  var emptyEl = modal.querySelector('.search-empty');
  var closers = modal.querySelectorAll('[data-search-close]');

  var fuse = null;
  var indexPromise = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('/search.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          fuse = new Fuse(data, {
            keys: [
              { name: 'title', weight: 0.7 },
              { name: 'excerpt', weight: 0.3 }
            ],
            threshold: 0.35,
            ignoreLocation: true
          });
        })
        .catch(function () { /* search unavailable */ });
    }
    return indexPromise;
  }

  function render(items) {
    resultsEl.innerHTML = '';
    emptyEl.hidden = items.length > 0 || input.value.trim() === '';

    items.slice(0, 8).forEach(function (item) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = item.url;
      a.innerHTML =
        '<span class="search-result-type">' + item.type + '</span>' +
        '<span class="search-result-title">' + item.title + '</span>' +
        '<span class="search-result-excerpt">' + item.excerpt + '</span>';
      li.appendChild(a);
      resultsEl.appendChild(li);
    });
  }

  function onInput() {
    var query = input.value.trim();
    if (!fuse || query === '') {
      resultsEl.innerHTML = '';
      emptyEl.hidden = true;
      return;
    }
    render(fuse.search(query).map(function (r) { return r.item; }));
  }

  function open() {
    modal.hidden = false;
    document.body.classList.add('search-open');
    loadIndex().then(onInput);
    input.value = '';
    resultsEl.innerHTML = '';
    emptyEl.hidden = true;
    setTimeout(function () { input.focus(); }, 0);
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove('search-open');
    toggle.focus();
  }

  toggle.addEventListener('click', open);
  closers.forEach(function (el) { el.addEventListener('click', close); });
  input.addEventListener('input', onInput);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) {
      close();
      return;
    }
    var tag = (e.target && e.target.tagName) || '';
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && modal.hidden) {
      e.preventDefault();
      open();
    }
  });
})();
