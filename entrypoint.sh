#!/bin/bash
set -e

mkdir -p /home/node/.openclaw/workspace

cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json
cp /home/node/.openclaw-baked/exec-approvals.json /home/node/.openclaw/exec-approvals.json
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

exec "$@"
