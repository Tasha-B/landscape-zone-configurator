import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

// Liveness for Docker healthchecks and the hosting platform. Nothing
// external is checked yet; phase 3 adds a Prisma ping, so the endpoint
// answers 503 while the database is down.
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
