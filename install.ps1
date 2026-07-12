Write-Host "Installing AutoQueuer..."

$spicetifyConfig = spicetify -c
$spicetifyDir = Split-Path -Parent $spicetifyConfig
$appDir = Join-Path $spicetifyDir "CustomApps\AutoQueuer"

New-Item -ItemType Directory -Force -Path $appDir | Out-Null

$baseUrl = "https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main"
Invoke-WebRequest -Uri "$baseUrl/manifest.json" -OutFile (Join-Path $appDir "manifest.json")
Invoke-WebRequest -Uri "$baseUrl/index.js" -OutFile (Join-Path $appDir "index.js")
Invoke-WebRequest -Uri "$baseUrl/extension.js" -OutFile (Join-Path $appDir "extension.js")
Invoke-WebRequest -Uri "$baseUrl/style.css" -OutFile (Join-Path $appDir "style.css")

spicetify config custom_apps AutoQueuer
spicetify apply

Write-Host "AutoQueuer installed successfully! :D" -ForegroundColor Green