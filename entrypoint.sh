#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

# Only copy baked config if no existing config in volume
if [ ! -f /home/node/.openclaw/openclaw.json ]; then
  cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
  echo "[entrypoint] initialized openclaw.json from baked config"
else
  echo "[entrypoint] using existing openclaw.json from volume"
fi

# Set gateway auth token from account ID if provided
if [ -n "$PRECISION_ACCOUNT_ID" ]; then
  sed -i "s/\"token\": \"[^\"]*\"/\"token\": \"$PRECISION_ACCOUNT_ID\"/" /home/node/.openclaw/openclaw.json
  echo "[entrypoint] gateway token set from PRECISION_ACCOUNT_ID"
fi

cp /home/node/.openclaw-baked/exec-approvals.json /home/node/.openclaw/exec-approvals.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

exec "$@"
