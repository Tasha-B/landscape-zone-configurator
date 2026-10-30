import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

// Global, so feature modules inject PrismaService without importing this
// module, and the whole app shares one connection pool
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
