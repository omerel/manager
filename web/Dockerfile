# =============================================================================
# Air-gap-ready image: everything resolved at build time (on a connected
# machine), zero network fetches at runtime. Deliver via docker save/load.
# Runs under OpenShift restricted SCC (arbitrary UID, group 0).
# =============================================================================

# ---------- builder ----------
FROM ubuntu:24.04 AS builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# fonts (next/font) download here, at build time — self-hosted from then on
RUN npx prisma generate && npm run build \
 && npm prune --omit=dev

# ---------- runner ----------
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
# fonts-noto: Hebrew rendering in PDF export (Chromium print)
# poppler-utils: pdftotext/pdftoppm — document text extraction
# tesseract + heb/eng: OCR fallback for scanned documents and images
# python3: runs docker/emailer.py — absent here, mail works in dev and dies with
#          ENOENT in the delivered image, discovered only when a user clicks send
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
      fonts-noto fonts-noto-color-emoji \
      poppler-utils tesseract-ocr tesseract-ocr-heb tesseract-ocr-eng \
      python3 \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    HOME=/app/.home \
    PLAYWRIGHT_BROWSERS_PATH=/app/.pw-browsers \
    UPLOADS_DIR=/app/uploads \
    PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src/generated ./src/generated
COPY docker ./docker

# Chromium for PDF export — installed into an app-owned path (see env above)
RUN node_modules/.bin/playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

# Claude CLI baked in; its runtime env (gateway/auth) is passed through at run time
RUN npm install -g @anthropic-ai/claude-code

# OpenShift restricted SCC: arbitrary UID with group 0 must be able to write
RUN mkdir -p /app/uploads /app/.home \
 && chgrp -R 0 /app \
 && chmod -R g=u /app \
 && chmod +x /app/docker/entrypoint.sh

VOLUME /app/uploads
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
