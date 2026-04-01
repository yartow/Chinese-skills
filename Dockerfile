# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev deps needed for the build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled backend + frontend bundle
COPY --from=builder /app/dist ./dist

# Seed data files (characters-seed.json, radicals-seed.json)
# autoSeed.ts resolves these relative to process.cwd()/server/data
COPY --from=builder /app/server/data ./server/data

# The built server resolves its own path via import.meta.dirname
# which becomes dist/, so the static frontend lives at dist/public/
# and is already copied above — nothing extra needed.

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "dist/index.js"]
