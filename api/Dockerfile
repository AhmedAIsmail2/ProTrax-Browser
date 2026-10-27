FROM node:26-alpine

ARG VERSION=dev
ARG VCS_REF=dev
ARG BUILD_DATE=unknown

LABEL maintainer="Asmit Jogdand (SmitroniX) https://github.com/SmitroniX" \
    org.opencontainers.image.title="smitrix-api" \
    org.opencontainers.image.description="Backend for Self-hosted gym & body-weight tracker — plan routines, log workouts (supersets & cardio too), track your weight and progress, passkey login. Your data, your server." \
    org.opencontainers.image.source="https://github.com/SmitroniX/SmiTriX" \
    org.opencontainers.image.url="https://github.com/SmitroniX/SmiTriX" \
    org.opencontainers.image.documentation="https://github.com/SmitroniX/SmiTriX#readme" \
    org.opencontainers.image.licenses="AGPL-3.0-or-later" \
    org.opencontainers.image.version=$VERSION \
    org.opencontainers.image.revision=$VCS_REF \
    org.opencontainers.image.created=$BUILD_DATE

WORKDIR /app

# The base image is rebuilt on node's schedule, not alpine's: between two node releases the
# alpine packages it ships (openssl above all) fall behind their fixes. Taking the upgrades at
# build time keeps the published image at alpine's current state without waiting for node.
RUN apk upgrade --no-cache

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js push-messages.js verify-error.js ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]

HEALTHCHECK --interval=5m \
            --timeout=5s \
            --retries=3 \
            CMD wget --spider -q "http://127.0.0.1:${PORT}/api/health" || exit 1


