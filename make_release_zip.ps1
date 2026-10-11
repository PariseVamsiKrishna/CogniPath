# CogniPath Release Archive Generator
# Creates a clean distribution zip containing ONLY tracked source files
# (Excludes virtualenvs, node_modules, dist bundles, local .env files, caches, and test databases).

param (
    [string]$OutputFile = "cognipath_release.zip"
)

Write-Host "Creating clean release archive: $OutputFile" -ForegroundColor Cyan

if (Get-Command git -ErrorAction SilentlyContinue) {
    git archive --format=zip --output=$OutputFile HEAD
    Write-Host "Release archive created successfully via git archive: $OutputFile" -ForegroundColor Green
} else {
    Write-Host "git command not found. Falling back to PowerShell archive with exclusions..." -ForegroundColor Yellow
    $excludeList = @("venv", "node_modules", "dist", ".git", ".pytest_cache", "__pycache__")
    $files = Get-ChildItem -Path . -Recurse -File | Where-Object {
        $path = $_.FullName
        $keep = $true
        foreach ($ex in $excludeList) {
            if ($path -match "[\\/]$ex([\\/]|$)") { $keep = $false; break }
        }
        if ($path -match "\.env$" -or $path -match "cognipath\.db$" -or $path -match "uploads[\\/].+\.pdf$") { $keep = $false }
        $keep
    }
    Compress-Archive -Path $files.FullName -DestinationPath $OutputFile -Force
    Write-Host "Archive created: $OutputFile" -ForegroundColor Green
}
