import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { DepartmentsService } from "./departments.service";

@AllowAnonymous()
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async getAll(): Promise<{ departmentCount: number; departments: string[] }> {
    const departments = await this.departmentsService.getDepartments();
    return { departmentCount: departments.length, departments: departments };
  }
}
