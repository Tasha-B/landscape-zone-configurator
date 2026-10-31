import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { PlanResponse } from "./plan.response.js";
import { PlansService } from "./plans.service.js";

@ApiTags("plans")
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  // 400 for an id that is not a UUID, before the database is asked
  @Get(":id")
  @ApiOkResponse({ type: PlanResponse, description: "The plan with its zones in legend order" })
  @ApiBadRequestResponse({ description: "The id is not a UUID" })
  @ApiNotFoundResponse({ description: "No plan has this id" })
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<PlanResponse> {
    const plan = await this.plans.findOne(id);
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }
}
