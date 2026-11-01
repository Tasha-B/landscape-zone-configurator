import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { assertChanges } from "../validation.js";
import { CreateZoneDto, UpdateZoneDto } from "./zone.dto.js";
import { ZoneResponse } from "./zone.response.js";
import { ZonesService } from "./zones.service.js";

// A zone is created under its plan and then addressed by its own id. Every
// :id goes through ParseUUIDPipe (400); bodies through the global
// ValidationPipe (400).
@ApiTags("zones")
@Controller()
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Post("plans/:id/zones")
  @ApiCreatedResponse({ type: ZoneResponse, description: "The new zone, last in the legend, at version 1" })
  @ApiBadRequestResponse({ description: "The id is not a UUID or the body is invalid" })
  @ApiNotFoundResponse({ description: "No plan has this id" })
  async create(@Param("id", ParseUUIDPipe) planId: string, @Body() dto: CreateZoneDto): Promise<ZoneResponse> {
    const zone = await this.zones.create(planId, dto);
    if (!zone) throw new NotFoundException(`Plan ${planId} not found`);
    return zone;
  }

  @Patch("zones/:id")
  @ApiOkResponse({ type: ZoneResponse, description: "The changed zone, at the next version" })
  @ApiBadRequestResponse({ description: "The id is not a UUID, the body is invalid or changes nothing" })
  @ApiNotFoundResponse({ description: "No zone has this id" })
  @ApiConflictResponse({ description: "The zone has changed since the version sent; reload it" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateZoneDto): Promise<ZoneResponse> {
    assertChanges(dto);
    return this.zones.update(id, dto);
  }

  @Delete("zones/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: "The zone and its content are deleted" })
  @ApiBadRequestResponse({ description: "The id is not a UUID" })
  @ApiNotFoundResponse({ description: "No zone has this id" })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    if (!(await this.zones.remove(id))) throw new NotFoundException(`Zone ${id} not found`);
  }
}
