#!/bin/bash
set -e

# Refresh config (env vars get substituted at runtime)
cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

exec "$@"
