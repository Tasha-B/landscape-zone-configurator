import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

// The OpenAPI document of the API, built from the controllers' and the
// response classes' decorators. Served by the app and written to
// backend/openapi.json (write-openapi.ts), from which the frontend's types
// are generated.
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Landscape Zone Configurator API")
    .setDescription("Floor plans and their zones")
    .setVersion("1.0")
    .build();
  return SwaggerModule.createDocument(app, config, {
    // "plans_findOne" instead of "PlansController_findOne"
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, "").toLowerCase()}_${methodKey}`,
  });
}

// Swagger UI at /api/docs, the document at /api/docs-json
export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup("api/docs", app, () => createOpenApiDocument(app));
}
