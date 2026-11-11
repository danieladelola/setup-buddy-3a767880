# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

# Install deps with lockfile
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile

# Copy source and build (Nitro -> node-server preset, output in .output/)
COPY . .
RUN bun run build

# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Nitro node-server output is self-contained under .output/
COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
