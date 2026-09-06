import type { CourseSummary } from "@/types";
import { embedSingle } from "../ai";
import { getSummariesByCodes } from "../course/service";
import {
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

/**
 * Hybrid search: keyword and embedding in parallel, keyword order kept, new
 * semantic hits appended, sliced to `size`.
 *
 * ## `department` is the only filter, and it is deliberate
 *
 * There used to be a second one — a minimum-rating dropdown, "at least N
 * stars", thresholding the learning mean. It has been removed. It was in no
 * artboard: `docs/design_ref/2026-09-05/Course Community - Explore.dc.html`
 * draws no filter row at all, and the control was invented to satisfy #89.
 * With no design behind it there was nothing to be right about, so it went
 * rather than staying as a permanent, undesigned deviation.
 *
 * It also took a live bug with it. It could not be expressed in SQL — the
 * scores live in the reviews domain, so the threshold was applied here, in
 * application code, *after* the query had come back. To leave something to
 * filter, the query over-fetched `size * 5`. If more than four fifths of that
 * window missed the threshold the caller silently got fewer results than it
 * asked for, with nothing on the wire saying more existed. That failure mode
 * left with the feature, and the over-fetch went with it: `size` is now what
 * is fetched.
 *
 * `department` stays, and is still a deviation from the artboard — but a cheap
 * and honest one. It filters in SQL (`department ILIKE`, in the repository),
 * so the database does the narrowing, every returned row already satisfies it,
 * and the result count is whatever the caller asked for. It needs no window,
 * no second round trip, and no post-fetch pass.
 *
 * ## Why `total` is still a lie, and still #148
 *
 * The router returns `total: results.length` — the count of what it just
 * returned, not of what matches. Removing the rating filter clears **one of
 * three** reasons a truthful count could not be computed; two remain, and they
 * are the structural ones:
 *
 * - the result set is the union of two independent rankings, de-duplicated,
 *   which has no natural count short of running both queries unbounded; and
 * - the semantic path has no cutoff — every course with an embedding is a hit
 *   at some distance, so "how many match" is not a question it can answer.
 *
 * So a real pager still needs server work (a `COUNT` and an honoured offset),
 * and #148 still owns it. One fewer obstacle, not none.
 */
export async function searchCourses(
  query: string,
  size = 10,
  filters?: { department?: string },
): Promise<CourseSummary[]> {
  if (!query?.trim()) return [];
  const departmentFilter = resolveDepartmentFilter(filters?.department);

  const [keywordHits, semanticHits] = await Promise.all([
    searchByKeyword(query, size, departmentFilter),
    searchWithEmbedding(query, size, departmentFilter),
  ]);

  const seen = new Set(keywordHits.map((h) => h.courseCode));
  const codes = [
    ...keywordHits,
    ...semanticHits.filter((h) => !seen.has(h.courseCode)),
  ]
    .slice(0, size)
    .map((h) => h.courseCode);

  if (codes.length === 0) return [];

  return getSummariesByCodes(codes);
}

export function getDepartments(): Promise<string[]> {
  return listDepartments();
}
