import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { CourseService } from "./course.service";

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
