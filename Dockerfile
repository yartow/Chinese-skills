# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev deps needed for the build)
COPY package*.json ./
RUN npm install --prefer-offline

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev --prefer-offline

# Compiled backend + frontend bundle
COPY --from=builder /app/dist ./dist

# Seed data files (characters-seed.json, radicals-seed.json)
COPY --from=builder /app/server/data ./server/data

# drizzle-kit config and schema (needed for db:push at startup)
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/shared ./shared

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "dist/index.js"]
