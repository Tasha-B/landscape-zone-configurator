import { Test, type TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

// Placeholder from `nest new`, replaced by the health check in step 4. It
// also proves that constructor injection works under Vitest: Nest resolves
// AppService from the decorator metadata the test transform has to emit.
describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get(AppController);
  });

  it('returns "Hello World!"', () => {
    expect(appController.getHello()).toBe("Hello World!");
  });
});
