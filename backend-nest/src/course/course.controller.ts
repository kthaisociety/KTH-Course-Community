import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { SearchService } from "../search/search.service";
import { CourseService } from "./course.service";

@Controller("course")
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly elasticService: SearchService,
  ) {}

  //--------
  // Postgres NEON endpoints

  // /neon/:course_code for the neon SQL object
  @Get("/neon/:course_code")
  async getNeonCourse(@Param("course_code") courseCode: string) {
    const course = await this.courseService.getCourse(courseCode);

    if (!course) {
      throw new NotFoundException(
        `Course with code ${courseCode} not found in database.`,
      );
    }
    // We re-construct the object here to follow standards
    // But technically not needed, we could use schema names directly as well
    return {
      courseCode: course.code,
      department: course.department,
      name: course.name,
      currentStatus: course.state, // renaming here to status to avoid conflicting naming with "state"
      updatedAt: course.updatedAt,
    };
  }

  @Get("/neon/courseCodeExists/:course_code")
  async checkIfCourseCodeExists(@Param("course_code") courseCode: string) {
    const exists = await this.courseService.courseCodeExists(courseCode);
    return { exists };
  }

  @Get("/neon/courseCredits/:course_code")
  async getCourseCredits(@Param("course_code") courseCode: string) {
    const credits = await this.courseService.getCourseCredits(courseCode);
    return { credits };
  }

  //--------
  // ElasticSearch endpoints

  // Using SearchService from the search-module to reach ElasticSearch
  @Get(":course_code")
  async getElasticCourse(@Param("course_code") courseCode: string) {
    const courseDocument = // type?
      await this.elasticService.getCourseByCode(courseCode);

    if (!courseDocument) {
      throw new NotFoundException(
        `Course with code ${courseCode} not found in database.`,
      );
    }
    return {
      // good practice to have the mapping here as well
      // In the furure, needs to be fixed along with "Course type" in models, and the assigning of
      // properties in search.controller object return to map to the same type (Course).
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
