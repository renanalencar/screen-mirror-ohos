#!/usr/bin/env bash
set -euo pipefail

echo "[start] Syncing submodules and initializing..."
git submodule sync
git submodule update --init --recursive

for dir in signaling-server web-receiver; do
  if [ -d "$dir" ] && [ ! -d "$dir/.git" ]; then
    backup="${dir}.backup.$(date +%s)"
    echo "[start] Directory '$dir' exists and is not a git submodule — moving to $backup"
    mv "$dir" "$backup"
  fi
done

if [ -d signaling-server ]; then
  if [ -f signaling-server/package.json ]; then
    echo "[start] Installing signaling-server dependencies..."
    npm --prefix signaling-server install
  else
    echo "[start] signaling-server has no package.json — skipping npm install"
  fi
else
  echo "[start] signaling-server not found after init"
fi

echo "[start] Launching signaling server (foreground)..."
node signaling-server/server.js
