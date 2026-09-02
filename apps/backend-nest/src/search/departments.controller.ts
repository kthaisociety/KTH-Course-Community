import { Controller, Get } from "@nestjs/common";
import { DepartmentsService } from "./departments.service";

@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async getAll(): Promise<{ departmentCount: number; departments: string[] }> {
    const departments = await this.departmentsService.getDepartments();
    return { departmentCount: departments.length, departments: departments };
  }
}
