import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from "@nestjs/common";
import type { PlanResponse } from "./plan.response.js";
import { PlansService } from "./plans.service.js";

@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  // 400 for an id that is not a UUID, before the database is asked
  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<PlanResponse> {
    const plan = await this.plans.findOne(id);
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }
}
