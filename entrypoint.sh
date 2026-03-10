#!/bin/bash
set -e

echo "=== ENTRYPOINT START ==="
mkdir -p /home/node/.openclaw/workspace

echo "Applying platform config..."
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

chown -R node:node /home/node/.openclaw 2>/dev/null || true

echo "=== STARTING OPENCLAW ==="
export DEBUG="*"
export NODE_OPTIONS="--unhandled-rejections=strict"
stdbuf -oL -eL node openclaw.mjs gateway 2>&1 || echo "EXIT CODE: $?"