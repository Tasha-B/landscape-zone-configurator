import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validate } from "./config/env.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [
    // Reads backend/.env (process.env wins) and validates it at startup
    ConfigModule.forRoot({ isGlobal: true, validate }),
    HealthModule,
  ],
})
export class AppModule {}
