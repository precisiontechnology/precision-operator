#!/bin/bash
set -e

# Dockerfile already set up .openclaw with config, plugins, and workspace
# Just run the gateway
exec "$@"
