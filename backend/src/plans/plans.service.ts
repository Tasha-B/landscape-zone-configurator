import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { versionedUpdate } from "../prisma/versioned-update.js";
import type { CreatePlanDto, UpdatePlanDto } from "./plan.dto.js";
import type { PlanSummaryResponse } from "./plan-summary.response.js";
import { toPlanResponse } from "./plan.mapper.js";
import type { PlanResponse } from "./plan.response.js";

// The plan with its zones in legend order and their content. Two zones
// added at the same moment can share a position; the older one comes first.
const WITH_ZONES = {
  zones: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { content: true } },
} satisfies Prisma.FloorPlanInclude;

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  // Oldest first, so the demo office leads the list
  async list(): Promise<PlanSummaryResponse[]> {
    const plans = await this.prisma.floorPlan.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, background: true, updatedAt: true, _count: { select: { zones: true } } },
    });
    return plans.map(({ _count, updatedAt, ...plan }) => ({
      ...plan,
      zoneCount: _count.zones,
      updatedAt: updatedAt.toISOString(),
    }));
  }

  // One query: the plan, its zones in legend order and their content
  async findOne(id: string): Promise<PlanResponse | null> {
    const plan = await this.prisma.floorPlan.findUnique({ where: { id }, include: WITH_ZONES });
    return plan && toPlanResponse(plan);
  }

  async create(dto: CreatePlanDto): Promise<PlanResponse> {
    const plan = await this.prisma.floorPlan.create({ data: { ...dto }, include: WITH_ZONES });
    return toPlanResponse(plan);
  }

  // 409 when the plan has a newer version than the one sent, 404 when it is gone
  async update(id: string, { version, ...changes }: UpdatePlanDto): Promise<PlanResponse> {
    const plan = await versionedUpdate(
      `Plan ${id}`,
      () =>
        this.prisma.floorPlan.update({
          where: { id, version },
          data: { ...changes, version: { increment: 1 } },
          include: WITH_ZONES,
        }),
      async () => (await this.prisma.floorPlan.count({ where: { id } })) > 0,
    );
    return toPlanResponse(plan);
  }

  // Zones and their content go with the plan (onDelete: Cascade). False when
  // there was no such plan.
  async remove(id: string): Promise<boolean> {
    const { count } = await this.prisma.floorPlan.deleteMany({ where: { id } });
    return count > 0;
  }
}
