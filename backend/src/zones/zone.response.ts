import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDefined, IsNotEmpty, IsPositive, IsString, MaxLength, ValidateNested } from "class-validator";
import { IsFiniteNumber, IsOmittable } from "../validation.js";
import { SHAPE_MODELS, ShapeProperty, type Shape } from "./shape.js";
import { ZONE_TYPE_NAMES, type ZoneTypeName } from "./zone-type.js";

// A zone as the API returns it. Names and structure follow the frontend
// model (frontend/src/lib/plan/types.ts), except that fields the frontend
// leaves out are null here, so every field is always present.
//
// ZoneLabel and the content classes also validate request bodies
// (zone.dto.ts).

export class ZoneLabel {
  @ApiProperty({ description: "Offset of the name from the shape center" })
  @IsFiniteNumber()
  dx!: number;
  @ApiProperty()
  @IsFiniteNumber()
  dy!: number;
  @ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true })
  @IsOmittable()
  @IsFiniteNumber()
  @IsPositive()
  fontSize?: number;
  @ApiPropertyOptional({ description: "Offset of the area caption below the name; the frontend default is 22" })
  @IsOmittable()
  @IsFiniteNumber()
  areaDy?: number;
}

export const MAX_SHORT_TEXT = 200;

export class ZoneContent {
  @ApiProperty({ minLength: 1, maxLength: MAX_SHORT_TEXT })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SHORT_TEXT)
  name!: string;
  @ApiProperty({ minLength: 1, maxLength: MAX_SHORT_TEXT })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SHORT_TEXT)
  tagline!: string;
  @ApiProperty({ minLength: 1 })
  @IsString()
  @IsNotEmpty()
  recommendation!: string;
  @ApiProperty({ minLength: 1 })
  @IsString()
  @IsNotEmpty()
  rationale!: string;
}

// One property per language (Lang in the schema). ValidateNested passes over
// a missing value, so IsDefined requires one.
export class ZoneContentByLang {
  @ApiProperty()
  @IsDefined()
  @ValidateNested()
  @Type(() => ZoneContent)
  en!: ZoneContent;
  @ApiProperty()
  @IsDefined()
  @ValidateNested()
  @Type(() => ZoneContent)
  ru!: ZoneContent;
}

@ApiExtraModels(...SHAPE_MODELS)
export class ZoneResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty({ enum: Object.values(ZONE_TYPE_NAMES), enumName: "ZoneType" })
  type!: ZoneTypeName;
  @ShapeProperty()
  shape!: Shape;
  @ApiProperty({ description: "Marker, hover tint and legend swatch" })
  color!: string;
  @ApiProperty({ type: "integer", description: "Paint and tab order" })
  zIndex!: number;
  @ApiProperty({ type: "integer", nullable: true, description: "null: the frontend default (20)" })
  hitPadding!: number | null;
  @ApiProperty({ type: ZoneLabel, nullable: true })
  label!: ZoneLabel | null;
  @ApiProperty({ type: "integer", description: "Increases with every change (optimistic concurrency)" })
  version!: number;
  @ApiProperty()
  content!: ZoneContentByLang;
}
