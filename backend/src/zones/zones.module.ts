import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { ZonesController } from "./zones.controller.js";
import { ZonesService } from "./zones.service.js";

@Module({
  imports: [RealtimeModule],
  controllers: [ZonesController],
  providers: [ZonesService],
})
export class ZonesModule {}
