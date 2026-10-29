import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { validate } from "./config/env.js";

@Module({
  imports: [
    // Reads backend/.env (process.env wins) and validates it at startup
    ConfigModule.forRoot({ isGlobal: true, validate }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
