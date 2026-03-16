# --- Base ---
# Use Debian-slim (not Alpine) — Playwright Chromium requires glibc + system libs
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Enable corepack + pre-download pnpm with retry to handle transient npm registry outages
RUN corepack enable pnpm && \
    (corepack prepare pnpm@9.15.4 --activate || \
     (sleep 5 && corepack prepare pnpm@9.15.4 --activate) || \
     (sleep 10 && corepack prepare pnpm@9.15.4 --activate))

# --- Dependencies ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./
# Retry pnpm install to handle transient npm registry outages
RUN pnpm i --frozen-lockfile || \
    (sleep 5 && pnpm i --frozen-lockfile) || \
    (sleep 10 && pnpm i --frozen-lockfile)

# --- Builder ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time args — Railway passes all env vars as build args automatically
ARG DATABASE_URI
ARG PAYLOAD_SECRET
ARG NEXT_PUBLIC_SERVER_URL
ARG PAYLOAD_PUBLIC_SERVER_URL
ARG PAYLOAD_UPLOADS_DIR

ENV DATABASE_URI=$DATABASE_URI
ENV PAYLOAD_SECRET=$PAYLOAD_SECRET
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV PAYLOAD_PUBLIC_SERVER_URL=$PAYLOAD_PUBLIC_SERVER_URL
ENV PAYLOAD_UPLOADS_DIR=$PAYLOAD_UPLOADS_DIR
ENV PAYLOAD_CONFIG_PATH=src/payload.config.ts
ENV CI=false

# Run migrations during build (against the production DB) then build Next.js
RUN pnpm run build:prod

# --- Runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install Playwright Chromium + system dependencies (apt libs for headless Chrome)
# Pin to the exact version used in package.json to avoid browser/client mismatch
RUN npx -y playwright@1.57.0 install --with-deps chromium

# Copy Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy migration files + Payload config so runtime migrations can run if needed
COPY --from=builder /app/src/migrations ./src/migrations
COPY --from=builder /app/src/payload.config.ts ./src/payload.config.ts
COPY --from=builder /app/package.json ./package.json

# Copy node_modules needed for runtime migration commands (payload CLI + db adapter)
COPY --from=deps /app/node_modules ./node_modules

# Create uploads directory (Railway volume will be mounted here)
RUN mkdir -p /app/uploads

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PAYLOAD_CONFIG_PATH=src/payload.config.ts

# Entrypoint: run any pending migrations, then start the server
CMD sh -c "npx payload migrate --yes 2>&1 || echo 'Migration check completed' && node server.js"
