import { Module } from "@nestjs/common";
import { PlanEventsGateway } from "./plan-events.gateway.js";

@Module({
  providers: [PlanEventsGateway],
  exports: [PlanEventsGateway],
})
export class RealtimeModule {}
