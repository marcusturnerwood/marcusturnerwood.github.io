# marcusturnerwood.github.io

Personal blog, built with Jekyll (`minima` theme) and hosted on GitHub Pages.

## Running locally

No Ruby installation required — this uses the official Jekyll Docker image.

```
docker run --rm -it -p 4000:4000 -v "$PWD":/srv/jekyll jekyll/jekyll:latest jekyll serve --host 0.0.0.0 --livereload --force_polling
```

Then open http://localhost:4000. `--force_polling` is needed for live-reload to pick up file changes on Windows/macOS bind mounts.
