import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 does not read .env by itself. Locally DATABASE_URL comes from
// backend/.env; in CI it is set in the environment, which wins over the
// file. Commands that do not touch the database (generate) run without it.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // tsx runs TypeScript directly; Node's own type stripping cannot follow
    // the generated client's .js imports
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
