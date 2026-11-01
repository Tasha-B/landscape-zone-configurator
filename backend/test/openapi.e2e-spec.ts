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

  it("documents the plan endpoints with their operation ids, bodies and errors", async () => {
    const { body } = await request(app.getHttpServer()).get("/api/docs-json").expect(200);
    const operations = {
      list: body.paths["/api/plans"].get,
      create: body.paths["/api/plans"].post,
      update: body.paths["/api/plans/{id}"].patch,
      remove: body.paths["/api/plans/{id}"].delete,
    };
    for (const [method, operation] of Object.entries(operations)) {
      expect(operation.operationId).toBe(`plans_${method}`);
    }
    expect(Object.keys(operations.create.responses)).toEqual(expect.arrayContaining(["201", "400"]));
    expect(Object.keys(operations.update.responses)).toEqual(expect.arrayContaining(["200", "400", "404", "409"]));
    expect(Object.keys(operations.remove.responses)).toEqual(expect.arrayContaining(["204", "400", "404"]));
    expect(operations.create.requestBody.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/CreatePlanDto",
    );
    expect(body.components.schemas.UpdatePlanDto.required).toEqual(["version"]);
  });

  it("documents the zone endpoints with their operation ids, bodies and errors", async () => {
    const { body } = await request(app.getHttpServer()).get("/api/docs-json").expect(200);
    const operations = {
      create: body.paths["/api/plans/{id}/zones"].post,
      update: body.paths["/api/zones/{id}"].patch,
      remove: body.paths["/api/zones/{id}"].delete,
    };
    for (const [method, operation] of Object.entries(operations)) {
      expect(operation.operationId).toBe(`zones_${method}`);
    }
    expect(Object.keys(operations.create.responses)).toEqual(expect.arrayContaining(["201", "400", "404"]));
    expect(Object.keys(operations.update.responses)).toEqual(expect.arrayContaining(["200", "400", "404", "409"]));
    expect(Object.keys(operations.remove.responses)).toEqual(expect.arrayContaining(["204", "400", "404"]));
    // The request bodies use the same shape union as the response
    expect(body.components.schemas.CreateZoneDto.properties.shape.discriminator.propertyName).toBe("kind");
    expect(body.components.schemas.UpdateZoneDto.required).toEqual(["version"]);
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
