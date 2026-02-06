---
layout: page
title: Themes
permalink: /themes/
---

{% assign cats = site.categories | sort %}
{% for c in cats %}
## {{ c[0] }}

{% for post in c[1] %}
- [{{ post.title }}]({{ post.url }}) ({{ post.date | date: "%Y-%m-%d" }})
{% endfor %}

{% endfor %}
