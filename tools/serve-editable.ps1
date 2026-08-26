# Back-compat pointer: the launcher now lives at the repo root as a single
# self-contained script (everything in one file). Kept here so existing
# references (e.g. _layouts/drafts.html) and old habits still work.
#
# Usage (from the repo root):
#   ./tools/serve-editable.ps1

& "$PSScriptRoot/../run.ps1"
