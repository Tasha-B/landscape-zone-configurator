import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";
import type { Env } from "../src/config/env.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

async function createApp(prisma?: PrismaService): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (prisma) builder = builder.overrideProvider(PrismaService).useValue(prisma);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
  await app.init();
  return app;
}

describe("health (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health reports the database up", async () => {
    const response = await request(app.getHttpServer()).get("/api/health").expect(200);
    // Terminus also reports each check's responseTime
    expect(response.body).toMatchObject({
      status: "ok",
      info: { database: { status: "up" } },
      error: {},
    });
  });

  it("serves routes only under /api", async () => {
    await request(app.getHttpServer()).get("/health").expect(404);
  });

  it("answers unknown API routes with 404", async () => {
    await request(app.getHttpServer()).get("/api/nope").expect(404);
  });
});

describe("health with the database down (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Nothing listens on port 1. The env is validated once per process, so
    // the client is swapped instead of DATABASE_URL
    const config = { get: () => "postgresql://lzc:lzc@localhost:1/lzc_test" };
    app = await createApp(new PrismaService(config as unknown as ConfigService<Env, true>));
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health answers 503 with the database down", async () => {
    const response = await request(app.getHttpServer()).get("/api/health").expect(503);
    expect(response.body).toMatchObject({
      status: "error",
      error: { database: { status: "down" } },
    });
  });
});
