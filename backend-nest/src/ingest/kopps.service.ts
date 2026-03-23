import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import type { z } from "zod";
import {
  CourseDetailSchema,
  CourseSchema,
  CoursesSchema,
} from "../../../types/ingest/schemas";

/*
Service fetches data from the KOPPS API.
(or any other new API for fetching courses in the future).
*/
@Injectable()
export class KoppsService {
  constructor(private readonly http: HttpService) {}

  async getCourses() {
    const endpoint = "https://api.kth.se/api/kopps/v2/courses?l=en";
    const { data } = await firstValueFrom(this.http.get(endpoint));
    return CoursesSchema.parse(data);
  }

  async getCourseInformation(course: z.infer<typeof CourseSchema>) {
    const endpoint = `https://api.kth.se/api/kopps/v2/course/${course.code}/detailedinformation`;
    await new Promise((r) => setTimeout(r, 200));
    const { data } = await firstValueFrom(this.http.get(endpoint));
    return CourseDetailSchema.parse(data);
  }
}
