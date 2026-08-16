(function () {
  var modal = document.getElementById('lightbox');
  if (!modal) return;

  var img = document.getElementById('lightbox-image');
  var caption = document.getElementById('lightbox-caption');

  function captionFor(el) {
    var figure = el.closest('figure');
    var figcaption = figure && figure.querySelector('figcaption');
    if (figcaption) return figcaption.textContent.trim();
    return el.getAttribute('alt') || '';
  }

  function open(el) {
    img.src = el.currentSrc || el.src;
    img.alt = el.getAttribute('alt') || '';
    var text = captionFor(el);
    caption.textContent = text;
    caption.hidden = !text;
    modal.hidden = false;
    document.body.classList.add('lightbox-open');
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove('lightbox-open');
    img.src = '';
  }

  document.addEventListener('click', function (e) {
    var target = e.target.closest && e.target.closest('.post-content img');
    if (!target || target.closest('.interactive-widget')) return;
    e.preventDefault();
    open(target);
  });

  Array.prototype.slice.call(modal.querySelectorAll('[data-lightbox-close]')).forEach(function (el) {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
})();
