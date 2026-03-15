FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl git python3 make g++ openssl && \
        corepack enable && \
        apt-get clean && rm -rf /var/lib/apt/lists/*

COPY . .

ENV NODE_ENV=production \
    NEXTAUTH_SECRET=build-time-secret \
    NEXTAUTH_URL=http://localhost:3000 \
    NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000 \
    NEXT_PUBLIC_API_V2_URL=http://localhost:3000/api/v2 \
    CALENDSO_ENCRYPTION_KEY=12345678901234567890123456789012 \
    DATABASE_URL=postgresql://calcom:calcom@localhost:5432/calcom \
    DATABASE_DIRECT_URL=postgresql://calcom:calcom@localhost:5432/calcom

RUN yarn install --immutable
RUN yarn prisma generate
RUN yarn workspace @calcom/trpc build
RUN NODE_OPTIONS="--max-old-space-size=12288" yarn workspace @calcom/web build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates openssl && \
        corepack enable && \
        apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app
COPY entrypoint.sh /usr/local/bin/calcom-source-entrypoint.sh
RUN chmod +x /usr/local/bin/calcom-source-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["calcom-source-entrypoint.sh"]
