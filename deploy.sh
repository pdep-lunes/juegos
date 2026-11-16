#!/bin/sh
# Publica dist/ en la rama gh-pages (la que sirve GitHub Pages).
set -e
cd "$(dirname "$0")"
REMOTE=$(git remote get-url origin)
SRC=$(git rev-parse --short HEAD)
cd dist
rm -rf .git
git init --quiet -b gh-pages
git add -A
git commit --quiet -m "Deploy desde $SRC"
git push --force --quiet "$REMOTE" gh-pages
rm -rf .git
echo "Publicado en https://pdep-lunes.github.io/juegos/"
