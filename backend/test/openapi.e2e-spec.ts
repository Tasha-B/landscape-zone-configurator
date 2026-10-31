import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configureApp } from "../src/app.js";
import { AppModule } from "../src/app.module.js";

describe("OpenAPI (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication<INestApplication<App>>());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves Swagger UI at /api/docs", async () => {
    const response = await request(app.getHttpServer()).get("/api/docs").expect(200);
    expect(response.text).toContain("swagger-ui");
  });

  it("documents GET /api/plans/:id with its responses", async () => {
    const { body } = await request(app.getHttpServer()).get("/api/docs-json").expect(200);
    const operation = body.paths["/api/plans/{id}"].get;
    expect(operation.operationId).toBe("plans_findOne");
    expect(Object.keys(operation.responses)).toEqual(expect.arrayContaining(["200", "400", "404"]));
  });

  it("describes the shape as one of three schemas, told apart by kind", async () => {
    const { body } = await request(app.getHttpServer()).get("/api/docs-json").expect(200);
    const { shape } = body.components.schemas.ZoneResponse.properties;
    expect(shape.discriminator.mapping).toEqual({
      rect: "#/components/schemas/RectShape",
      circle: "#/components/schemas/CircleShape",
      polygon: "#/components/schemas/PolygonShape",
    });
    for (const [kind, name] of Object.entries({ rect: "RectShape", circle: "CircleShape", polygon: "PolygonShape" })) {
      expect(body.components.schemas[name].properties.kind.enum).toEqual([kind]);
    }
  });
});
