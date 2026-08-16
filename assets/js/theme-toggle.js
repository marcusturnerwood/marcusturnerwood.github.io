(function () {
  var STORAGE_KEY = 'theme';
  var root = document.documentElement;

  function isDark() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'dark') return true;
    if (explicit === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.setAttribute('aria-pressed', String(isDark()));

  toggle.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    toggle.setAttribute('aria-pressed', String(next === 'dark'));
  });
})();
