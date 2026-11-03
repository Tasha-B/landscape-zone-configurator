# The API. Built from the repo's root, for its one lockfile:
#   docker build -f backend/Dockerfile -t lzc-api .

FROM node:24.22-slim AS build
# Prisma's CLI picks its schema engine by the OpenSSL it finds
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/prisma.config.ts backend/
COPY backend/prisma backend/prisma
# npm checks the lockfile against every workspace, also the one not installed
COPY frontend/package.json frontend/
# Runs `prisma generate` through postinstall, hence the schema above
RUN npm ci -w backend
COPY backend backend
RUN npm run build -w backend

# For one-off commands that need the CLI: migrations and the seed
FROM build AS tools
WORKDIR /app/backend
USER node

FROM node:24.22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# No scripts: postinstall needs the CLI, a dev dependency, and the generated
# client is already compiled into dist. No peers: optional ones keep prisma,
# typescript and vite out of --omit=dev's reach; the peers the API needs are
# its own dependencies.
RUN npm ci -w backend --omit=dev --ignore-scripts --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
WORKDIR /app/backend
USER node
EXPOSE 3000
# Not through npm, so that SIGTERM reaches Node and the app closes cleanly
CMD ["node", "dist/main.js"]
