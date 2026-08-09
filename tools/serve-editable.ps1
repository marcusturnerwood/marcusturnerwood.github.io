# Convenience launcher: starts the inline-edit save server in the background,
# then runs the normal Jekyll dev server in the foreground (Ctrl+C stops both).
#
# Usage (from the repo root):
#   ./tools/serve-editable.ps1
#
# Equivalent to running these in two terminals:
#   python tools/edit_server.py
#   bundle exec jekyll serve --drafts

$editServer = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    python tools/edit_server.py
}

Write-Host "Started edit_server.py as background job (id $($editServer.Id)) on http://localhost:4001"
Write-Host "Starting Jekyll on http://localhost:4000 ... (Ctrl+C to stop both)"

try {
    bundle exec jekyll serve --drafts
}
finally {
    Write-Host "Stopping edit_server.py background job..."
    Stop-Job $editServer -ErrorAction SilentlyContinue
    Remove-Job $editServer -ErrorAction SilentlyContinue
}
