---
layout: page
title: Themes
permalink: /themes/
---

## Themes (categories)
{% for c in site.categories %}
  {% assign name = c[0] %}
  {% assign slug = name | slugify %}
- [{{ name }}](/themes/{{ slug }}/)
{% endfor %}
