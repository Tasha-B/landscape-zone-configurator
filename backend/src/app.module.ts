import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validate } from "./config/env.js";
import { HealthModule } from "./health/health.module.js";
import { PlansModule } from "./plans/plans.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ZonesModule } from "./zones/zones.module.js";

@Module({
  imports: [
    // Reads backend/.env (process.env wins) and validates it at startup
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    HealthModule,
    PlansModule,
    ZonesModule,
  ],
})
export class AppModule {}
