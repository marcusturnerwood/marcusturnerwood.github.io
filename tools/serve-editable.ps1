# Convenience launcher: starts the inline-edit save server in the background,
# then runs the normal Jekyll dev server in the foreground (Ctrl+C stops both).
#
# Usage (from the repo root):
#   ./tools/serve-editable.ps1
#
# Equivalent to running these in two terminals:
#   python tools/edit_server.py
#   bundle exec jekyll serve --drafts --unpublished
#
# --unpublished is what lets a project marked `published: false` in its own
# front matter (see _layouts/drafts.html) still build and stay editable
# locally, the same way --drafts does for _drafts/ posts. Production never
# passes either flag, so both stay genuinely unbuilt there.
#
# Gemfile lives in site/ (not the repo root) — point bundler at it explicitly.
$env:BUNDLE_GEMFILE = Join-Path $PSScriptRoot "..\site\Gemfile"

$editServer = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    python tools/edit_server.py
}

Write-Host "Started edit_server.py as background job (id $($editServer.Id)) on http://localhost:4001"
Write-Host "Starting Jekyll on http://localhost:4000 ... (Ctrl+C to stop both)"

try {
    bundle exec jekyll serve --drafts --unpublished
}
finally {
    Write-Host "Stopping edit_server.py background job..."
    Stop-Job $editServer -ErrorAction SilentlyContinue
    Remove-Job $editServer -ErrorAction SilentlyContinue
}
