FROM node:24-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV HIDE_NEXT_DEV_INDICATOR=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/db/custom.db

COPY package*.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
ARG P00RIJA_BUILD_MEMORY_MB
ARG P00RIJA_BUILD_CPUS
RUN P00RIJA_MEMORY_MB_OVERRIDE="$P00RIJA_BUILD_MEMORY_MB" \
    P00RIJA_CPU_COUNT_OVERRIDE="$P00RIJA_BUILD_CPUS" \
    sh scripts/hardware-profile.sh build sh -c "npx prisma generate && npm run build"

# Keep runtime small: Prisma remains a production dependency; build tooling does not.
FROM node:24-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache sqlite ffmpeg

ENV NEXT_TELEMETRY_DISABLED=1
ENV HIDE_NEXT_DEV_INDICATOR=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/db/custom.db

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma/init.sql ./prisma/init.sql
COPY --from=builder /app/prisma/default-admin-password.txt ./prisma/default-admin-password.txt

RUN mkdir -p /app/db /app/logs && chmod +x /app/scripts/container-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "scripts/hardware-profile.sh", "run", "sh", "scripts/container-entrypoint.sh"]
