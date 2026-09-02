import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { HealthService } from "./health.service";

@AllowAnonymous()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    const status = await this.healthService.testAll();

    if (!status.ok) {
      // if not OK, this auto to sned code 503, which is needed for docker health check
      throw new HttpException(status, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return status; // if everything is OK
  }
}
