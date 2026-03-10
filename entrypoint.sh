#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

echo "Applying platform config..."
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

chown -R node:node /home/node/.openclaw 2>/dev/null || true

echo "=== STARTING OPENCLAW ==="
exec node openclaw.mjs gateway