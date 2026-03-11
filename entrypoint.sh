#!/bin/bash
set -e

# Only copy workspace, NOT the config (plugin install already configured it)
cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/

exec "$@"
