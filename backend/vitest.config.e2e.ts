import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    // The app validates its env at startup. No .env exists in CI, and no
    // test connects to the database yet, so a valid placeholder is enough.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
