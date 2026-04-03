import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
// Schema imports
import * as schema from "../../../types/database/schema";
import { courses, SelectCourse } from "../../../types/database/schema";
// Drizzle imports
import { DRIZZLE } from "../database/drizzle.module";

@Injectable()
export class CourseService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async getCourse(courseCode: string): Promise<SelectCourse | undefined> {
    const courseObject = await this.db
      .select()
      .from(courses)
      .where(eq(courses.code, courseCode)) // fetches the course from the course code
      .limit(1);
    return courseObject[0]; // [0] beacuse we technically have a 1 element array from the database
  }

  async courseCodeExists(courseCode: string): Promise<boolean> {
    const courseObject = await this.db
      .select()
      .from(courses)
      .where(eq(courses.code, courseCode))
      .limit(1);
    return courseObject.length > 0;
  }

  async getCourseCredits(courseCode: string): Promise<number | null> {
    // Select only credits to avoid querying columns that may not exist.
    const courseObject = await this.db
      .select({ credits: courses.credits })
      .from(courses)
      .where(eq(courses.code, courseCode))
      .limit(1);
    return courseObject[0]?.credits ?? null;
  }
}
