(function () {
  var toc = document.getElementById('toc');
  var content = document.querySelector('.post-content');
  if (!toc || !content) return;

  var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3'));
  if (headings.length < 3) return;

  var usedIds = {};
  function slugify(text) {
    var base = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
    var id = base, n = 1;
    while (usedIds[id]) { id = base + '-' + (++n); }
    usedIds[id] = true;
    return id;
  }

  var list = document.createElement('ol');
  list.className = 'toc-list';

  headings.forEach(function (h) {
    if (!h.id) {
      h.id = slugify(h.textContent);
    } else {
      usedIds[h.id] = true;
    }

    var li = document.createElement('li');
    li.className = 'toc-item toc-item--' + h.tagName.toLowerCase();
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    li.appendChild(a);
    list.appendChild(li);
  });

  var details = document.createElement('details');
  details.className = 'toc-details';
  details.open = true;
  var summary = document.createElement('summary');
  summary.textContent = 'Contents';
  details.appendChild(summary);
  details.appendChild(list);
  toc.appendChild(details);
  toc.classList.add('has-items');

  if (window.IntersectionObserver) {
    var links = {};
    list.querySelectorAll('a').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        var active = list.querySelector('a.active');
        if (active) active.classList.remove('active');
        link.classList.add('active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    headings.forEach(function (h) { observer.observe(h); });
  }
})();
