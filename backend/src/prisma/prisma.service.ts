import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

// The app's database client: inject PrismaService wherever a query is
// needed. It connects on the first query, not at startup, so the API also
// starts while the database is down and /api/health reports it as 503.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get("DATABASE_URL", { infer: true }) }) });
  }

  // Runs on app.close() and, with shutdown hooks enabled, on SIGTERM
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
