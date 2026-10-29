import type { INestApplication } from "@nestjs/common";

// App-wide HTTP setup, shared by main.ts and the e2e tests so that the
// tests hit the same URLs as the running app
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix("api");
  return app;
}
