import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";

describe("health (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health reports ok", async () => {
    const response = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok" });
  });

  it("serves routes only under /api", async () => {
    await request(app.getHttpServer()).get("/health").expect(404);
  });

  it("answers unknown API routes with 404", async () => {
    await request(app.getHttpServer()).get("/api/nope").expect(404);
  });
});
