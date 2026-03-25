# --- Base ---
# Use Debian-slim (not Alpine) — Playwright Chromium requires glibc + system libs
FROM node:22-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable pnpm && \
    (corepack prepare pnpm@9.15.4 --activate || \
     (sleep 5 && corepack prepare pnpm@9.15.4 --activate) || \
     (sleep 10 && corepack prepare pnpm@9.15.4 --activate))

# --- Dependencies ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./

RUN pnpm i --frozen-lockfile || \
    (sleep 5 && pnpm i --frozen-lockfile) || \
    (sleep 10 && pnpm i --frozen-lockfile)

# --- Builder ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time args — Railway passes env vars as build args
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

# Generate fresh Payload types before building
RUN pnpm exec payload generate:types

# Build app only (no migrations during image build)
RUN pnpm run build:prod

# --- Runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PAYLOAD_CONFIG_PATH=src/payload.config.ts

# Install Playwright Chromium + system dependencies
RUN npx -y playwright@1.57.0 install --with-deps chromium

# Copy Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Payload files needed at runtime
COPY --from=builder /app/src/migrations ./src/migrations
COPY --from=builder /app/src/payload.config.ts ./src/payload.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/payload-types.ts ./src/payload-types.ts

# Copy runtime dependencies
COPY --from=deps /app/node_modules ./node_modules

# Create uploads directory (Railway volume can be mounted here)
RUN mkdir -p /app/uploads

EXPOSE 3000

# Run pending migrations on container start, then start server
CMD sh -c "pnpm exec payload migrate --yes && node server.js"