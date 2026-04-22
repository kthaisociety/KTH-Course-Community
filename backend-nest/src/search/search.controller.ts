import { Controller, Get, Query } from "@nestjs/common";
import type { SearchResponse } from "@shared/types";
import { SearchService } from "./search.service";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("size") size?: string,
    @Query("department") department?: string,
    @Query("minRating") minRating?: string,
  ): Promise<SearchResponse> {
    const pageNum =
      Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const pageSize = Number.isFinite(Number(size)) ? Number(size) : 10;
    const minRatingNum = Number.isFinite(Number(minRating))
      ? Number(minRating)
      : undefined;

    const results = await this.searchService.searchCourses(q ?? "", pageSize, {
      department,
      minRating: minRatingNum,
    });

    return {
      results,
      total: results.length,
      page: pageNum,
      pageSize,
    };
  }
}
