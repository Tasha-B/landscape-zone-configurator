import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
// ESM needs the file extension for a subpath of a package without "exports"
import type { App } from "supertest/types.js";
import { afterEach, beforeEach, describe, it } from "vitest";
import { AppModule } from "../src/app.module.js";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /", () => {
    return request(app.getHttpServer()).get("/").expect(200).expect("Hello World!");
  });
});
