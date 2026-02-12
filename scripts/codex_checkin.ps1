# Codex Check-In Script for AI Agent IDE
# Run this to print the Codex review prompt and optionally run lint/build checks.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Agent IDE — Codex Check-In" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Print the check-in prompt
$promptFile = Join-Path $PSScriptRoot "..\docs\CODEX_CHECKIN_PROMPT.md"
if (Test-Path $promptFile) {
    Write-Host "--- Codex Prompt (copy into Codex exec) ---" -ForegroundColor Yellow
    Get-Content $promptFile | Write-Host
    Write-Host ""
} else {
    Write-Host "WARNING: CODEX_CHECKIN_PROMPT.md not found at $promptFile" -ForegroundColor Red
}

# Run build check
Write-Host "--- Running Build Check ---" -ForegroundColor Yellow
try {
    Push-Location (Join-Path $PSScriptRoot "..")
    npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "BUILD: PASS" -ForegroundColor Green
    } else {
        Write-Host "BUILD: FAIL" -ForegroundColor Red
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "--- Check-In Complete ---" -ForegroundColor Cyan
Write-Host "Copy the prompt above into ChatGPT Codex exec with your repo attached." -ForegroundColor Gray
