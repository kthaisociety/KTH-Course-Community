import type { CourseSummary } from "@/types";
import { embedSingle } from "../ai";
import { getSummariesByCodes } from "../course/service";
import {
  averageRatings,
  listDepartments,
  type SearchHit,
  searchByEmbedding,
  searchByKeyword,
} from "./repository";

export type { SearchHit };

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

export async function searchCourses(
  query: string,
  size = 10,
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
    const ratingByCode = await averageRatings(codes);
    codes = codes.filter((c) => (ratingByCode.get(c) ?? 0) >= minRating);
  }

  codes = codes.slice(0, size);

  return getSummariesByCodes(codes);
}

export function getDepartments(): Promise<string[]> {
  return listDepartments();
}
