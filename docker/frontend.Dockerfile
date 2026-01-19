# syntax=docker/dockerfile:1
FROM node:20-bookworm AS builder

RUN corepack enable \
    ; corepack prepare pnpm@10.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY applications/webui-frontend ./applications/webui-frontend
COPY common ./common

# Install deps needed for frontend build only
RUN pnpm --filter vite-template install --frozen-lockfile

RUN cd applications/webui-frontend \
    ; pnpm -s run build

FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/applications/webui-frontend/dist /usr/share/nginx/html
EXPOSE 80
