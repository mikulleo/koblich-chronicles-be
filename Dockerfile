# --- Base ---
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

RUN pnpm exec payload generate:types
RUN pnpm run build:prod

# --- Runner ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PAYLOAD_CONFIG_PATH=src/payload.config.ts

RUN npx -y playwright@1.57.0 install --with-deps chromium

# Next.js standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy full source + tsconfig so Payload runtime migrations can resolve config imports
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/payload-types.ts ./src/payload-types.ts

# Runtime deps for payload migrate
COPY --from=deps /app/node_modules ./node_modules

RUN mkdir -p /app/uploads

EXPOSE 3000

CMD sh -c "PAYLOAD_CONFIG_PATH=src/payload.config.ts pnpm exec payload migrate --yes && node server.js"