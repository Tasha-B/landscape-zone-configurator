import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { PlansController } from "./plans.controller.js";
import { PlansService } from "./plans.service.js";

@Module({
  imports: [RealtimeModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
