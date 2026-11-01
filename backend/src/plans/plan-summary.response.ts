import { ApiProperty } from "@nestjs/swagger";

// One plan in GET /api/plans: enough to list and open it
export class PlanSummaryResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: String, nullable: true })
  background!: string | null;
  @ApiProperty({ type: "integer" })
  zoneCount!: number;
  @ApiProperty({ format: "date-time" })
  updatedAt!: string;
}
