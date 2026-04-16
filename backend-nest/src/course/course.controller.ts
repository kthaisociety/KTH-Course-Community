import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { SearchService } from "../search/search.service";
import { CourseService } from "./course.service";

@Controller("course")
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly elasticService: SearchService,
  ) {}

  // --- Postgres (NEON) endpoints ------------
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

  // --- ElasticSearch endpoints ------------
  @Get(":course_code")
  async getElasticCourse(@Param("course_code") courseCode: string) {
    const courseDocument =
      await this.elasticService.getCourseByCode(courseCode);

    if (!courseDocument) {
      throw new NotFoundException(
        `Course with code ${courseCode} not found in database.`,
      );
    }
    return {
      _id: courseDocument._id,
      courseCode: courseDocument.course_code,
      department: courseDocument.department,
      nameSwe: courseDocument.course_name_swe,
      nameEng: courseDocument.course_name_eng,
      goals: courseDocument.goals,
      content: courseDocument.content,
      credits: courseDocument.credits,
      rating: courseDocument.rating,
    };
  }
}
