#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json

# Substitute PRECISION_ACCOUNT_ID into config (used by mem0 plugin)
if [ -n "$PRECISION_ACCOUNT_ID" ]; then
  sed -i "s/\${PRECISION_ACCOUNT_ID}/$PRECISION_ACCOUNT_ID/g" /home/node/.openclaw/openclaw.json
  echo "[entrypoint] PRECISION_ACCOUNT_ID substituted into config"
fi

cp /home/node/.openclaw-baked/exec-approvals.json /home/node/.openclaw/exec-approvals.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

exec "$@"
