// `npm run api:spec`: writes the OpenAPI document to backend/openapi.json.
// Runs from the build, because Nest needs the decorator metadata that tsc
// emits and tsx does not. No server is started, and no database is needed:
// PrismaService connects on the first query.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { configureApp } from "./app.js";
import { AppModule } from "./app.module.js";
import { createOpenApiDocument } from "./openapi.js";

const app = configureApp(await NestFactory.create(AppModule, { logger: ["error"] }));
const document = createOpenApiDocument(app);
await app.close();

const path = fileURLToPath(new URL("../openapi.json", import.meta.url));
writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${path}`);
