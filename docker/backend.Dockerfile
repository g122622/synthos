# syntax=docker/dockerfile:1
FROM node:20-bookworm

# Native deps for sqlite3/better-sqlite3/sqlcipher/onnxruntime builds when prebuilds are unavailable
RUN apt-get update \
    ; apt-get install -y --no-install-recommends python3 make g++ pkg-config libssl-dev ca-certificates \
    ; rm -rf /var/lib/apt/lists/*

# Use Corepack to pin pnpm
RUN corepack enable \
    ; corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

# Copy workspace sources
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.config.ts commitlint.config.js ./
COPY scripts ./scripts
COPY common ./common
COPY applications ./applications

# Install all workspace deps (simplest + most reliable for monorepo)
RUN pnpm install --frozen-lockfile

# Build backend packages and apply the same postbuild steps used by devRunner
RUN cd applications/orchestrator \
    ; pnpm -s run build \
    ; node ../../scripts/redirectRequire.js \
    ; node ../../scripts/fixESMExtensions.mjs

RUN cd applications/preprocessing \
    ; pnpm -s run build \
    ; node ../../scripts/redirectRequire.js \
    ; node ../../scripts/fixESMExtensions.mjs

RUN cd applications/ai-model \
    ; pnpm -s run build \
    ; node ../../scripts/redirectRequire.js \
    ; node ../../scripts/fixESMExtensions.mjs

RUN cd applications/webui-backend \
    ; pnpm -s run build \
    ; node ../../scripts/redirectRequire.js \
    ; node ../../scripts/fixESMExtensions.mjs

# Default command is overridden per-service in docker-compose
CMD ["node", "applications/webui-backend/dist/index.js"]
