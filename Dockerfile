FROM ghcr.io/openclaw/openclaw:2026.3.8

USER root

# Bake platform config
COPY config/workspace/ /home/node/.openclaw-baked/workspace/
COPY config/openclaw.json /home/node/.openclaw-baked/openclaw.json

# Copy skills
COPY skills/ /app/skills/

# Fix ownership BEFORE switching to node
RUN chown -R node:node /home/node/.openclaw-baked

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER node

# Set up .openclaw and install plugin at build time
RUN mkdir -p /home/node/.openclaw/workspace && \
    cp /home/node/.openclaw-baked/openclaw.json /home/node/.openclaw/openclaw.json && \
    cp -r /home/node/.openclaw-baked/workspace/* /home/node/.openclaw/workspace/ && \
    openclaw plugins install @mem0/openclaw-mem0

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "openclaw.mjs", "gateway"]
