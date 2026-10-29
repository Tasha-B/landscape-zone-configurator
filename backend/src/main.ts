import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { configureApp } from "./app.js";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";

const app = configureApp(await NestFactory.create(AppModule));
const config = app.get<ConfigService<Env, true>>(ConfigService);
await app.listen(config.get("PORT", { infer: true }));
