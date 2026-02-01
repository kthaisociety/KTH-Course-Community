import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { CourseMapping } from "../../../types/search/elastic.mappings";
import { type SearchResult, SearchService } from "./search.service";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  //   Extend with more filters when needed, start simple now
  async search(
    @Query("q") q?: string,
    @Query("size") size?: string,
    @Query("department") department?: string,
    @Query("minRating") minRating?: string,
  ) {
    const limit = Number.isFinite(Number(size)) ? Number(size) : 10;
    const minRatingNum = Number.isFinite(Number(minRating))
      ? Number(minRating)
      : undefined;
    const results: SearchResult[] = await this.searchService.searchCourses(
      q ?? "",
      limit,
      { department, minRating: minRatingNum },
    );
    return { results, total: results.length };
  }
}
