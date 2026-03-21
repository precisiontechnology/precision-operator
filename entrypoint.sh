#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json

# Set gateway auth token from account ID if provided
if [ -n "$PRECISION_ACCOUNT_ID" ]; then
  sed -i "s/\"token\": \"[^\"]*\"/\"token\": \"$PRECISION_ACCOUNT_ID\"/" /home/node/.openclaw/openclaw.json
  echo "[entrypoint] gateway token set from PRECISION_ACCOUNT_ID"
fi

cp /home/node/.openclaw-baked/exec-approvals.json /home/node/.openclaw/exec-approvals.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

exec "$@"
