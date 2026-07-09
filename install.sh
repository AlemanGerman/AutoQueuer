#!/bin/bash

echo "Installing AutoQueuer..."

CUSTOM_APPS_DIR="$(spicetify -c | xargs dirname)/CustomApps"
APP_DIR="$CUSTOM_APPS_DIR/AutoQueuer"

mkdir -p "$APP_DIR"

curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/dist/manifest.json -o "$APP_DIR/manifest.json"
curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/dist/icon.svg -o "$APP_DIR/icon.svg"
curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/dist/index.js -o "$APP_DIR/index.js"
curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/dist/extension.js -o "$APP_DIR/extension.js"
curl -fsSL https://raw.githubusercontent.com/AlemanGerman/AutoQueuer/main/dist/style.css -o "$APP_DIR/style.css"


spicetify config custom_apps AutoQueuer
spicetify apply

echo "AutoQueuer installed successfully! :D"