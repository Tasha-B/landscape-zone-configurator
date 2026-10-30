import { defineConfig } from "vitest/config";

// E2E tests use their own database, so they never touch development data.
// Locally it lives in the docker-compose Postgres (`npm run db:up`); in CI
// DATABASE_URL points at the service container and wins over this default.
process.env.DATABASE_URL ??= "postgresql://lzc:lzc@localhost:5432/lzc_test";
process.env.NODE_ENV = "test";

export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    // Applies the migrations once before the run; creates the database if needed
    globalSetup: ["test/global-setup.ts"],
    // The files share one database
    fileParallelism: false,
  },
});
