#!/bin/sh

echo "Installing AutoQueuer..."

mkdir -p ~/.config/spicetify/custom_apps/autoqueuer

curl -fsSL https://raw.githubusercontent.com/TuUsuario/AutoQueuer/main/manifest.json -o ~/.config/spicetify/custom_apps/autoqueuer/manifest.json
curl -fsSL https://raw.githubusercontent.com/TuUsuario/AutoQueuer/main/icon.svg -o ~/.config/spicetify/custom_apps/autoqueuer/icon.svg

curl -fsSL https://enlace-a-tu-extension-js-compilado.js -o ~/.config/spicetify/custom_apps/autoqueuer/extension.js

spicetify config custom_apps autoqueuer
spicetify apply

echo "AutoQueuer installed succesfully! :D"
