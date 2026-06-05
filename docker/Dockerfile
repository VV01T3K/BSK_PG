FROM oven/bun:1.3.14-alpine AS deps

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/ttp/package.json apps/ttp/package.json
COPY packages/crypto/package.json packages/crypto/package.json
COPY packages/rpc/package.json packages/rpc/package.json

RUN bun install --frozen-lockfile

FROM deps AS build

ARG VITE_TTP_API_BASE_URL=http://localhost:3001
ARG VITE_SERVICE_API_BASE_URL=http://localhost:3002

ENV VITE_TTP_API_BASE_URL=${VITE_TTP_API_BASE_URL}
ENV VITE_SERVICE_API_BASE_URL=${VITE_SERVICE_API_BASE_URL}

COPY apps ./apps
COPY packages ./packages

RUN bun run build

FROM oven/bun:1.3.14-alpine AS client

WORKDIR /app
ENV PORT=3000

COPY --from=build /app/apps/client/.output ./.output

EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]

FROM oven/bun:1.3.14-alpine AS server

WORKDIR /app
ENV LOG_DIR=/app/logs

COPY --from=build /app/apps/server/dist/index.js ./index.js

RUN mkdir -p /app/logs

EXPOSE 3002
CMD ["bun", "index.js"]

FROM oven/bun:1.3.14-alpine AS ttp

WORKDIR /app
ENV LOG_DIR=/app/logs

COPY --from=build /app/apps/ttp/dist/index.js ./index.js

RUN mkdir -p /app/logs

EXPOSE 3001
CMD ["bun", "index.js"]
