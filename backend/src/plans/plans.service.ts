import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { toPlanResponse } from "./plan.mapper.js";
import type { PlanResponse } from "./plan.response.js";

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  // One query: the plan, its zones in legend order and their content
  async findOne(id: string): Promise<PlanResponse | null> {
    const plan = await this.prisma.floorPlan.findUnique({
      where: { id },
      include: { zones: { orderBy: { position: "asc" }, include: { content: true } } },
    });
    return plan && toPlanResponse(plan);
  }
}
