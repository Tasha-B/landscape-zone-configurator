import { Injectable } from "@nestjs/common";
import { Lang, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { versionedUpdate } from "../prisma/versioned-update.js";
import { ZONE_TYPES_BY_NAME } from "./zone-type.js";
import type { CreateZoneDto, UpdateZoneDto } from "./zone.dto.js";
import { toZoneResponse } from "./zone.mapper.js";
import type { ZoneLabel, ZoneResponse } from "./zone.response.js";

const LANGS = Object.values(Lang);

// shape and label are JSON columns, written whole. The DTOs have checked
// them; Prisma needs DbNull, not null, to clear a JSON column.
const json = (value: object) => ({ ...value }) as Prisma.InputJsonObject;
const labelJson = (label: ZoneLabel | null) => (label === null ? Prisma.DbNull : json(label));

@Injectable()
export class ZonesService {
  constructor(private readonly prisma: PrismaService) {}

  // The zone goes last in the legend; its zIndex, unless sent, puts it above
  // the plan's other zones. Null when there is no such plan.
  async create(planId: string, dto: CreateZoneDto): Promise<ZoneResponse | null> {
    const { _max, _count } = await this.prisma.zone.aggregate({
      where: { planId },
      _max: { position: true, zIndex: true },
      _count: true,
    });
    if (_count === 0 && !(await this.planExists(planId))) return null;

    try {
      const zone = await this.prisma.zone.create({
        data: {
          planId,
          type: ZONE_TYPES_BY_NAME[dto.type],
          shape: json(dto.shape),
          color: dto.color,
          zIndex: dto.zIndex ?? (_max.zIndex ?? 0) + 1,
          position: (_max.position ?? -1) + 1,
          hitPadding: dto.hitPadding ?? null,
          label: labelJson(dto.label ?? null),
          content: { create: LANGS.map((lang) => ({ lang, ...dto.content[lang] })) },
        },
        include: { content: true },
      });
      return toZoneResponse(zone);
    } catch (error) {
      // The plan was deleted between the two queries (foreign key violation)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return null;
      throw error;
    }
  }

  // 409 when the zone has a newer version than the one sent, 404 when it is
  // gone. The zone and the languages sent change in one transaction.
  async update(id: string, { version, type, shape, label, content, ...changes }: UpdateZoneDto): Promise<ZoneResponse> {
    const zone = await versionedUpdate(
      `Zone ${id}`,
      () =>
        this.prisma.$transaction(async (tx) => {
          await tx.zone.update({
            where: { id, version },
            data: {
              ...changes,
              ...(type !== undefined && { type: ZONE_TYPES_BY_NAME[type] }),
              ...(shape !== undefined && { shape: json(shape) }),
              ...(label !== undefined && { label: labelJson(label) }),
              version: { increment: 1 },
            },
          });
          for (const lang of LANGS) {
            const text = content?.[lang];
            if (!text) continue;
            await tx.zoneContent.upsert({
              where: { zoneId_lang: { zoneId: id, lang } },
              create: { zoneId: id, lang, ...text },
              update: { ...text },
            });
          }
          return tx.zone.findUniqueOrThrow({ where: { id }, include: { content: true } });
        }),
      async () => (await this.prisma.zone.count({ where: { id } })) > 0,
    );
    return toZoneResponse(zone);
  }

  // The other zones keep their legend order; gaps in position do not matter.
  // False when there was no such zone.
  async remove(id: string): Promise<boolean> {
    const { count } = await this.prisma.zone.deleteMany({ where: { id } });
    return count > 0;
  }

  private async planExists(id: string): Promise<boolean> {
    return (await this.prisma.floorPlan.count({ where: { id } })) > 0;
  }
}
