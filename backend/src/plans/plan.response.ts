import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from "@nestjs/swagger";
import { ZONE_TYPE_NAMES, type ZoneTypeName } from "./zone-type.js";

// The response of GET /api/plans/:id. Names and structure follow the
// frontend model (frontend/src/lib/plan/types.ts), except that fields the
// frontend leaves out are null here, so every field is always present.
//
// The decorators describe the classes in the OpenAPI document, from which
// the frontend's types are generated (npm run api:spec, api:types). A fixed
// minItems/maxItems becomes a tuple there.

const point = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 } as const;

export class RectShape {
  @ApiProperty({ enum: ["rect"] })
  kind!: "rect";
  @ApiProperty()
  x!: number;
  @ApiProperty()
  y!: number;
  @ApiProperty()
  width!: number;
  @ApiProperty()
  height!: number;
  @ApiProperty({ description: "Corner radius" })
  rx!: number;
}

export class CircleShape {
  @ApiProperty({ enum: ["circle"] })
  kind!: "circle";
  @ApiProperty()
  cx!: number;
  @ApiProperty()
  cy!: number;
  @ApiProperty()
  r!: number;
}

export class PolygonShape {
  @ApiProperty({ enum: ["polygon"] })
  kind!: "polygon";
  @ApiProperty({ type: "array", items: point, description: "Curves are approximated by points" })
  points!: [number, number][];
}

export type Shape = RectShape | CircleShape | PolygonShape;

export class ZoneLabel {
  @ApiProperty({ description: "Offset of the name from the shape center" })
  dx!: number;
  @ApiProperty()
  dy!: number;
  @ApiPropertyOptional()
  fontSize?: number;
  @ApiPropertyOptional({ description: "Offset of the area caption below the name; the frontend default is 22" })
  areaDy?: number;
}

export class ZoneContentResponse {
  @ApiProperty()
  name!: string;
  @ApiProperty()
  tagline!: string;
  @ApiProperty()
  recommendation!: string;
  @ApiProperty()
  rationale!: string;
}

// One property per language (Lang in the schema)
export class ZoneContentByLang {
  @ApiProperty()
  en!: ZoneContentResponse;
  @ApiProperty()
  ru!: ZoneContentResponse;
}

@ApiExtraModels(RectShape, CircleShape, PolygonShape)
export class ZoneResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty({ enum: Object.values(ZONE_TYPE_NAMES), enumName: "ZoneType" })
  type!: ZoneTypeName;
  @ApiProperty({
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
  })
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

export class PlanResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ ...point, minItems: 4, maxItems: 4, description: "[minX, minY, width, height]" })
  viewBox!: [number, number, number, number];
  @ApiProperty()
  pxPerMeter!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    description: '"demo-office": the demo office\'s artwork; null: a blank sheet',
  })
  background!: string | null;
  @ApiProperty({ type: [ZoneResponse], description: "Legend order" })
  zones!: ZoneResponse[];
}
