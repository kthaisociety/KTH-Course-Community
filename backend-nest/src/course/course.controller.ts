import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { CourseService } from "./course.service";

@AllowAnonymous() // ALL endpoints are public / open to non logged-in users
@Controller("course")
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get("/:course_code")
  async getCourseSummary(@Param("course_code") courseCode: string) {
    const courseSummary = await this.courseService.getSummary(courseCode);
    if (!courseSummary) {
      throw new NotFoundException(
        `Course with code ${courseCode} not found in database.`,
      );
    }
    return courseSummary;
  }

  @Get("/:course_code/details")
  async getCourseDetails(@Param("course_code") courseCode: string) {
    const courseDetails = await this.courseService.getDetails(courseCode);
    if (!courseDetails) {
      throw new NotFoundException(
        `Course with code ${courseCode} not found in database.`,
      );
    }
    return courseDetails;
  }
}
