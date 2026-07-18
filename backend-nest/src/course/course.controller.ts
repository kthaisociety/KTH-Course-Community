import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { CourseService } from "./course.service";

// Public endpoint: cap the IN-list so arbitrary callers can't send huge queries
const MAX_NAME_LOOKUP_CODES = 200;

@Controller("course")
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get("/names")
  async getCourseNames(@Query("codes") codesParam: string) {
    if (!codesParam?.trim()) return [];
    const codes = [
      ...new Set(
        codesParam
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      ),
    ].slice(0, MAX_NAME_LOOKUP_CODES);
    return this.courseService.getCourseNames(codes);
  }

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
