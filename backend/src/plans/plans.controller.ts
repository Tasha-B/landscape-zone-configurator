import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { assertChanges } from "../validation.js";
import { CreatePlanDto, UpdatePlanDto } from "./plan.dto.js";
import { PlanSummaryResponse } from "./plan-summary.response.js";
import { PlanResponse } from "./plan.response.js";
import { PlansService } from "./plans.service.js";

// Every :id goes through ParseUUIDPipe: 400 for an id that is not a UUID,
// before the database is asked. Request bodies are checked by the global
// ValidationPipe (400).
@ApiTags("plans")
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @ApiOkResponse({ type: [PlanSummaryResponse], description: "Every plan, oldest first" })
  list(): Promise<PlanSummaryResponse[]> {
    return this.plans.list();
  }

  @Get(":id")
  @ApiOkResponse({ type: PlanResponse, description: "The plan with its zones in legend order" })
  @ApiBadRequestResponse({ description: "The id is not a UUID" })
  @ApiNotFoundResponse({ description: "No plan has this id" })
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<PlanResponse> {
    const plan = await this.plans.findOne(id);
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  @Post()
  @ApiCreatedResponse({ type: PlanResponse, description: "The new plan, without zones, at version 1" })
  @ApiBadRequestResponse({ description: "The body is invalid" })
  create(@Body() dto: CreatePlanDto): Promise<PlanResponse> {
    return this.plans.create(dto);
  }

  @Patch(":id")
  @ApiOkResponse({ type: PlanResponse, description: "The changed plan with its zones, at the next version" })
  @ApiBadRequestResponse({ description: "The id is not a UUID, the body is invalid or changes nothing" })
  @ApiNotFoundResponse({ description: "No plan has this id" })
  @ApiConflictResponse({ description: "The plan has changed since the version sent; reload it" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto): Promise<PlanResponse> {
    assertChanges(dto);
    return this.plans.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: "The plan and its zones are deleted" })
  @ApiBadRequestResponse({ description: "The id is not a UUID" })
  @ApiNotFoundResponse({ description: "No plan has this id" })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    if (!(await this.plans.remove(id))) throw new NotFoundException(`Plan ${id} not found`);
  }
}
