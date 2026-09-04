import type { CourseSummary } from "@/types";
import { embedSingle } from "../ai";
import { getSummariesByCodes } from "../course/service";
import { getAggregatesByCourseCodes } from "../reviews/service";
import {
  listDepartments,
  type SearchHit,
  searchByEmbedding,
  searchByKeyword,
} from "./repository";

export type { SearchHit };

/**
 * The search filter asks for a minimum in stars, 1-5, because that is how the
 * dropdown renders. Review scores are stored 1-10. Convert the threshold up
 * rather than the averages down: the comparison then happens in the scale the
 * columns actually use, and no rounding is invented on the way.
 */
const SCORE_POINTS_PER_STAR = 2;

const embeddingCache = new Map<string, number[]>();
const embeddingInflight = new Map<string, Promise<number[]>>();
let embeddingSearchFailures = 0;

function resolveDepartmentFilter(department?: string): string | null {
  if (!department) return null;
  const departments = ["EECS", "ABE", "CBH", "ITM", "SCI"];
  const matchingDepts = departments.find((abbr) => department.includes(abbr));
  return matchingDepts ?? department;
}

async function resolveEmbedding(query: string): Promise<number[] | null> {
  const cacheKey = query.trim().toLowerCase();
  const cached = embeddingCache.get(cacheKey);
  if (cached) return cached;

  let pending = embeddingInflight.get(cacheKey);
  if (!pending) {
    let settle!: (v: number[]) => void;
    let fail!: (e: unknown) => void;
    pending = new Promise<number[]>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    embeddingInflight.set(cacheKey, pending);
    void pending
      .finally(() => {
        embeddingInflight.delete(cacheKey);
      })
      .catch(() => {});
    void embedSingle(query).then(
      ({ embedding: fresh }) => {
        try {
          if (embeddingCache.size >= 500) {
            const firstKey = embeddingCache.keys().next().value;
            if (firstKey !== undefined) {
              embeddingCache.delete(firstKey);
            }
          }
          embeddingCache.set(cacheKey, fresh);
          settle(fresh);
        } catch (e: unknown) {
          fail(e);
        }
      },
      (err: unknown) => {
        embeddingSearchFailures += 1;
        const detail = err instanceof Error ? err.message : String(err);
        console.warn(
          `Embedding search failed, returning []. (failure #${embeddingSearchFailures}) ${detail}`,
        );
        fail(err);
      },
    );
  }

  try {
    return await pending;
  } catch {
    return null;
  }
}

async function searchWithEmbedding(
  query: string,
  limit: number,
  departmentFilter: string | null,
): Promise<SearchHit[]> {
  try {
    const embedding = await resolveEmbedding(query);
    if (!embedding) return [];
    return await searchByEmbedding(embedding, limit, departmentFilter);
  } catch (err) {
    embeddingSearchFailures += 1;
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(
      `Embedding search failed, returning []. (failure #${embeddingSearchFailures}) ${detail}`,
    );
    return [];
  }
}

/**
 * `minRating` is the dropdown's "at least N stars", and what it measures is
 * the **learning score**: how much reviewers got out of the course.
 *
 * It used to be the mean of workload and learning together, which made a
 * punishing course score like a rewarding one. `CONTEXT.md` is explicit that
 * workload is not a verdict — a heavy course is not a bad one — so averaging
 * it into a rating filter told users the opposite of what they asked. Of the
 * axes a review actually stores, learning is the only one that moves in the
 * direction a minimum-rating filter means; `happy_took` is a yes/no share on
 * a different question, not a 1-10 score to threshold. See #67.
 *
 * A course with no reviews has no rating, so it cannot clear a minimum and is
 * filtered out — absent, rather than a zero that would rank it last.
 *
 * The threshold is compared against the raw stored mean. Search is choosing
 * courses, not drawing a card, so it takes the reviews domain's aggregate
 * rather than the rounded figures `course/service.ts` assembles for display.
 */
export async function searchCourses(
  query: string,
  size = 10,
  /** `minRating` is in stars (1-5), not in stored score points (1-10). */
  filters?: { department?: string; minRating?: number },
): Promise<CourseSummary[]> {
  if (!query?.trim()) return [];
  const departmentFilter = resolveDepartmentFilter(filters?.department);
  const hasMinRatingFilter = Boolean(filters?.minRating);

  const fetchSize = hasMinRatingFilter ? size * 5 : size;
  const [keywordHits, semanticHits] = await Promise.all([
    searchByKeyword(query, size, departmentFilter, hasMinRatingFilter),
    searchWithEmbedding(query, fetchSize, departmentFilter),
  ]);

  const seen = new Set(keywordHits.map((h) => h.courseCode));
  const ranked = [
    ...keywordHits,
    ...semanticHits.filter((h) => !seen.has(h.courseCode)),
  ].slice(0, fetchSize);

  if (ranked.length === 0) return [];

  let codes = ranked.map((h) => h.courseCode);

  const minRating = filters?.minRating;
  if (minRating) {
    // The reviews domain's raw aggregate, not the course card's numbers: the
    // card rounds its means to one decimal for display, and a 5.99 rounded up
    // to 6.0 would clear a three-star threshold it actually misses. Filtering
    // reads the unrounded score; rounding stays at the presentation edge.
    const aggregates = await getAggregatesByCourseCodes(codes);
    const learningMeanByCode = new Map(
      aggregates.map((row) => [row.courseCode, row.learningMean]),
    );
    const threshold = minRating * SCORE_POINTS_PER_STAR;
    codes = codes.filter((code) => {
      const learningMean = learningMeanByCode.get(code);
      return learningMean !== undefined && learningMean >= threshold;
    });
  }

  codes = codes.slice(0, size);

  return getSummariesByCodes(codes);
}

export function getDepartments(): Promise<string[]> {
  return listDepartments();
}
