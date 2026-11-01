import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateBy, isNumber } from "class-validator";
import { FINITE, IsFiniteNumber } from "../validation.js";
import { VIEW_BOX_SCHEMA } from "./plan.response.js";

// Request bodies of POST and PATCH /api/plans

// The values the frontend can draw. Widened when plans get uploaded images.
export const PLAN_BACKGROUNDS = ["demo-office"] as const;

export const MAX_PLAN_NAME = 200;

// [minX, minY, width, height]: four finite numbers, a sheet with an area
function IsViewBox() {
  return ValidateBy({
    name: "isViewBox",
    validator: {
      validate: (value) =>
        Array.isArray(value) &&
        value.length === 4 &&
        value.every((n) => isNumber(n, FINITE)) &&
        value[2] > 0 &&
        value[3] > 0,
      defaultMessage: (args) =>
        `${args?.property} must be [minX, minY, width, height] with finite numbers and a width and height above 0`,
    },
  });
}

export class CreatePlanDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_PLAN_NAME })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PLAN_NAME)
  name!: string;
  @ApiProperty(VIEW_BOX_SCHEMA)
  @IsViewBox()
  viewBox!: [number, number, number, number];
  @ApiProperty({ minimum: 0, exclusiveMinimum: true, description: "viewBox units per meter" })
  @IsFiniteNumber()
  @IsPositive()
  pxPerMeter!: number;
  @ApiPropertyOptional({
    type: String,
    enum: PLAN_BACKGROUNDS,
    nullable: true,
    description: "null or left out: a blank sheet",
  })
  @IsOptional()
  @IsIn(PLAN_BACKGROUNDS)
  background?: string | null;
}

// Every field of CreatePlanDto may be left out, but only `background` may be
// null (skipNullProperties: false keeps null from reaching NOT NULL columns)
export class UpdatePlanDto extends PartialType(CreatePlanDto, { skipNullProperties: false }) {
  @ApiProperty({ type: "integer", minimum: 1, description: "The version the change is based on; 409 if it is stale" })
  @IsInt()
  @Min(1)
  version!: number;
}
