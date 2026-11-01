import { ApiProperty } from "@nestjs/swagger";
import { POINT_SCHEMA } from "../zones/shape.js";
import { ZoneResponse } from "../zones/zone.response.js";

// The response of GET /api/plans/:id. Names and structure follow the
// frontend model (frontend/src/lib/plan/types.ts), except that fields the
// frontend leaves out are null here, so every field is always present.
//
// The decorators describe the classes in the OpenAPI document, from which
// the frontend's types are generated (npm run api:spec, api:types). A fixed
// minItems/maxItems becomes a tuple there.

export const VIEW_BOX_SCHEMA = {
  ...POINT_SCHEMA,
  minItems: 4,
  maxItems: 4,
  description: "[minX, minY, width, height]",
} as const;

export class PlanResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty(VIEW_BOX_SCHEMA)
  viewBox!: [number, number, number, number];
  @ApiProperty()
  pxPerMeter!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    description: '"demo-office": the demo office\'s artwork; null: a blank sheet',
  })
  background!: string | null;
  @ApiProperty({ type: "integer", description: "Increases with every change (optimistic concurrency)" })
  version!: number;
  @ApiProperty({ type: [ZoneResponse], description: "Legend order" })
  zones!: ZoneResponse[];
}
