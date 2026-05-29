FROM oven/bun:1.3.12

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY apps ./apps

RUN bun install --frozen-lockfile

EXPOSE 3000 3001

CMD ["bun", "run", "dev"]
