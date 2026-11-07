# The frontend: the built app behind nginx, which also forwards /api to the
# API. Built from the repo's root, for its one lockfile:
#   docker build -f frontend/Dockerfile -t lzc-web .

FROM node:24.22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
# npm checks the lockfile against every workspace, also the one not installed
COPY backend/package.json backend/
RUN npm ci -w frontend
COPY frontend frontend
# The showcase's plan, read at build time; empty means the demo office
ARG VITE_PLAN_ID=
ENV VITE_PLAN_ID=$VITE_PLAN_ID
# Only the bundle: types and tests are checked in CI, and a test reads the
# demo plan from backend/prisma, which is not here
WORKDIR /app/frontend
RUN npx vite build

# Runs as a non-root user and listens on 8080
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
