# marcusturnerwood.github.io

Personal blog, built with Jekyll (`minima` theme) and hosted on GitHub Pages.

## Running locally

No Ruby installation required — this uses the official Jekyll Docker image.

```
docker run --rm -it -p 4000:4000 -v "$PWD":/srv/jekyll jekyll/jekyll:latest jekyll serve --host 0.0.0.0 --livereload --force_polling
```

Then open http://localhost:4000. `--force_polling` is needed for live-reload to pick up file changes on Windows/macOS bind mounts.

Add `--drafts` to also preview unpublished posts sitting in `_drafts/` (that folder is gitignored — nothing in it gets committed until you move a post into `_posts/`).

## Comments & likes (giscus)

Comments and reactions (likes) are powered by [giscus](https://giscus.app), which stores them as GitHub Discussions on this repo — free, no tracking, no ads. Already configured (see `giscus:` in `_config.yml`), using the repo's `General` Discussion category.

Moderation note: comments appear as soon as they're posted (GitHub Discussions has no pre-approval queue). To remove one, delete or lock the relevant discussion/comment on GitHub directly — watch the repo to get notified as they come in. Because `General` is an open-ended category rather than "Announcement"-restricted, anyone with a GitHub account can also start a new top-level Discussion there directly (not just via a giscus comment on a post) — if unrelated threads start showing up, moving to a dedicated, maintainer-only-restricted category is the fix (create it, update `giscus.category`/`category_id` in `_config.yml`, restart).

## Email subscription (Buttondown)

The primary "follow this blog" option is an email subscribe form (homepage + footer), via [Buttondown](https://buttondown.com) — free tier, no backend needed, the form posts straight to Buttondown's hosted endpoint. Not yet configured: sign up, then set `buttondown.username` in `_config.yml` and restart the server (config changes need a restart, not just a rebuild). The form is hidden automatically whenever `buttondown.username` is empty.

The RSS feed (`/feed.xml`) still exists and is valid — Buttondown can actually auto-import new posts from it and email them out, so once a username is set there's no need to change anything about how posts get published.
