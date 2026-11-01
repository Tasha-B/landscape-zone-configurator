import type { INestApplication } from "@nestjs/common";
import { setupOpenApi } from "./openapi.js";
import { createValidationPipe } from "./validation.js";

// App-wide HTTP setup, shared by main.ts and the e2e tests so that the
// tests hit the same URLs and validate the same way as the running app
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api");
  app.useGlobalPipes(createValidationPipe());
  setupOpenApi(app);
  return app;
}
