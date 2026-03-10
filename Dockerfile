FROM ghcr.io/openclaw/openclaw:2026.3.8

USER root
RUN npx playwright install chromium --with-deps && \
    chmod -R 755 /root/.cache/ms-playwright && \
    chmod 755 /root
USER node

COPY skills/ /app/skills/
