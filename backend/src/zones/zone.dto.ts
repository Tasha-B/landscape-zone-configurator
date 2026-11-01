import { ApiExtraModels, ApiProperty, ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDefined, IsIn, IsInt, IsOptional, Matches, Min, ValidateNested } from "class-validator";
import { IsOmittable } from "../validation.js";
import { SHAPE_MODELS, ShapeProperty, type Shape } from "./shape.js";
import { ZONE_TYPE_NAMES, type ZoneTypeName } from "./zone-type.js";
import { ZoneContent, ZoneContentByLang, ZoneLabel } from "./zone.response.js";

// Request bodies of POST /api/plans/:id/zones and PATCH /api/zones/:id

export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

@ApiExtraModels(...SHAPE_MODELS)
export class CreateZoneDto {
  @ApiProperty({ enum: Object.values(ZONE_TYPE_NAMES), enumName: "ZoneType" })
  @IsIn(Object.values(ZONE_TYPE_NAMES))
  type!: ZoneTypeName;
  @ShapeProperty()
  shape!: Shape;
  @ApiProperty({ pattern: COLOR_PATTERN.source, example: "#C9962A", description: "Marker, hover tint and legend swatch" })
  @Matches(COLOR_PATTERN, { message: "color must be #rrggbb" })
  color!: string;
  @ApiPropertyOptional({ type: "integer", description: "Paint and tab order; default: above the plan's other zones" })
  @IsOmittable()
  @IsInt()
  zIndex?: number;
  @ApiPropertyOptional({ type: "integer", minimum: 0, nullable: true, description: "null: the frontend default (20)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  hitPadding?: number | null;
  @ApiPropertyOptional({ type: ZoneLabel, nullable: true, description: "null: placed at the shape center" })
  @IsOptional()
  @ValidateNested()
  @Type(() => ZoneLabel)
  label?: ZoneLabel | null;
  @ApiProperty({ description: "Both languages: the frontend shows every zone in both" })
  @IsDefined()
  @ValidateNested()
  @Type(() => ZoneContentByLang)
  content!: ZoneContentByLang;
}

// Content in a PATCH: one language or both, each replaced whole
export class ZoneContentPatch {
  @ApiPropertyOptional()
  @IsOmittable()
  @ValidateNested()
  @Type(() => ZoneContent)
  en?: ZoneContent;
  @ApiPropertyOptional()
  @IsOmittable()
  @ValidateNested()
  @Type(() => ZoneContent)
  ru?: ZoneContent;
}

// Every field may be left out; only hitPadding and label may be null (back
// to the frontend defaults). shape and label are replaced whole.
export class UpdateZoneDto extends PartialType(OmitType(CreateZoneDto, ["content"] as const), {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ type: ZoneContentPatch })
  @IsOmittable()
  @ValidateNested()
  @Type(() => ZoneContentPatch)
  content?: ZoneContentPatch;
  @ApiProperty({ type: "integer", minimum: 1, description: "The version the change is based on; 409 if it is stale" })
  @IsInt()
  @Min(1)
  version!: number;
}
