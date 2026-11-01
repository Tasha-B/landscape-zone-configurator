import { applyDecorators } from "@nestjs/common";
import { ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsPositive,
  Min,
  ValidateBy,
  ValidateNested,
  isNumber,
  type ValidationOptions,
} from "class-validator";
import { FINITE, IsFiniteNumber } from "../validation.js";

// The three zone shapes, in the frontend's structure
// (frontend/src/lib/plan/types.ts). The same classes describe responses and
// validate request bodies. Coordinates are in units of the plan's viewBox;
// they are not checked against it, because the viewBox can change after the
// zones exist.

// [x, y]; a fixed minItems/maxItems becomes a tuple in the generated types
export const POINT_SCHEMA = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 } as const;

export function IsPoint(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: "isPoint",
      validator: {
        validate: (value) => Array.isArray(value) && value.length === 2 && value.every((n) => isNumber(n, FINITE)),
        defaultMessage: (args) => `each point of ${args?.property} must be [x, y] with finite numbers`,
      },
    },
    options,
  );
}

export class RectShape {
  @ApiProperty({ enum: ["rect"] })
  @IsIn(["rect"])
  kind!: "rect";
  @ApiProperty()
  @IsFiniteNumber()
  x!: number;
  @ApiProperty()
  @IsFiniteNumber()
  y!: number;
  @ApiProperty({ minimum: 0, exclusiveMinimum: true })
  @IsFiniteNumber()
  @IsPositive()
  width!: number;
  @ApiProperty({ minimum: 0, exclusiveMinimum: true })
  @IsFiniteNumber()
  @IsPositive()
  height!: number;
  @ApiProperty({ minimum: 0, description: "Corner radius" })
  @IsFiniteNumber()
  @Min(0)
  rx!: number;
}

export class CircleShape {
  @ApiProperty({ enum: ["circle"] })
  @IsIn(["circle"])
  kind!: "circle";
  @ApiProperty()
  @IsFiniteNumber()
  cx!: number;
  @ApiProperty()
  @IsFiniteNumber()
  cy!: number;
  @ApiProperty({ minimum: 0, exclusiveMinimum: true })
  @IsFiniteNumber()
  @IsPositive()
  r!: number;
}

export class PolygonShape {
  @ApiProperty({ enum: ["polygon"] })
  @IsIn(["polygon"])
  kind!: "polygon";
  // No minItems in the schema: with --array-length, openapi-typescript turns
  // it into a tuple and nests the point type one level too deep
  @ApiProperty({
    type: "array",
    items: POINT_SCHEMA,
    description: "At least 3 points; curves are approximated by points",
  })
  @IsArray()
  @ArrayMinSize(3)
  @IsPoint({ each: true })
  points!: [number, number][];
}

export type Shape = RectShape | CircleShape | PolygonShape;

const SHAPE_KINDS = ["rect", "circle", "polygon"];

// What a shape with any other `kind`, or none, becomes before validation, so
// the error names `kind` instead of rejecting it as an unknown property
class UnknownShape {
  @IsIn(SHAPE_KINDS)
  kind!: string;
}

// A shape property: documented as one of the three schemas, and turned into
// the class its `kind` names before validation (UnknownShape for any other
// `kind`). ValidateNested passes over a missing value, so IsDefined requires
// one. The class using it registers the three classes with @ApiExtraModels.
export function ShapeProperty() {
  return applyDecorators(
    ApiProperty({
      oneOf: [
        { $ref: getSchemaPath(RectShape) },
        { $ref: getSchemaPath(CircleShape) },
        { $ref: getSchemaPath(PolygonShape) },
      ],
      // Without the mapping, generators take the schema names ("RectShape") as
      // the values of kind
      discriminator: {
        propertyName: "kind",
        mapping: {
          rect: getSchemaPath(RectShape),
          circle: getSchemaPath(CircleShape),
          polygon: getSchemaPath(PolygonShape),
        },
      },
    }),
    IsDefined(),
    ValidateNested(),
    Type(() => UnknownShape, {
      discriminator: {
        property: "kind",
        subTypes: [
          { name: "rect", value: RectShape },
          { name: "circle", value: CircleShape },
          { name: "polygon", value: PolygonShape },
        ],
      },
      keepDiscriminatorProperty: true,
    }),
  );
}

export const SHAPE_MODELS = [RectShape, CircleShape, PolygonShape];
