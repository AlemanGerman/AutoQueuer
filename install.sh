#!/bin/bash

CUSTOM_APPS_DIR="$(spicetify -c | xargs dirname)/CustomApps"
APP_DIR="$CUSTOM_APPS_DIR/AutoQueuer"

mkdir -p "$APP_DIR"

curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/manifest.json -o "$APP_DIR/manifest.json"
curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/icon.svg -o "$APP_DIR/icon.svg"

curl -fsSL https://github.com/AlemanGerman/AutoQueuer/releases/latest/download/extension.js -o "$APP_DIR/extension.js"

spicetify config custom_apps AutoQueuer
spicetify apply

echo "AutoQueuer installed successfully! :D"