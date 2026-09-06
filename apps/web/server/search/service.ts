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
 * How deep Explore can page, in pages.
 *
 * This is the one judgement call in #148 rather than something the data
 * dictates. The semantic leg has no relevance floor: its `WHERE` is effectively
 * "has an embedding", so every course in the catalogue is a hit at *some*
 * distance and the LIMIT is the only thing that makes the result a set rather
 * than the catalogue. Page 20 of that is not more results, it is courses sorted
 * by how little they match, presented with the same confidence as page 1.
 *
 * A cap says that honestly and costs nothing to defend. The alternative is a
 * similarity threshold, which means defending a specific number on cosine
 * distance — a number nobody here can justify from the data, and one that would
 * silently change meaning the next time the embedding model does.
 *
 * It is also what bounds the lookahead's cost: the deepest fetch this domain
 * will ever issue is `MAX_SEARCH_PAGES * size` rows, per leg.
 */
export const MAX_SEARCH_PAGES = 5;

/** The page size Explore asks for when it does not say. */
export const DEFAULT_SEARCH_PAGE_SIZE = 20;

export type SearchPageRequest = {
  page?: number;
  size?: number;
  department?: string;
};

export type SearchPage = {
  results: CourseSummary[];
  /**
   * The page actually served, which is the requested page clamped into
   * `[1, MAX_SEARCH_PAGES]`. Explore reads this back rather than trusting its
   * own `?page=`, so a hand-typed page past the cap lands on the last page
   * that exists instead of on a lie.
   */
  page: number;
  /**
   * Whether a next page exists — the answer to the only question a prev/next
   * pager asks. Never a count: see below for why there is not one to give.
   */
  hasMore: boolean;
};

function clampPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.min(Math.max(Math.trunc(page), 1), MAX_SEARCH_PAGES);
}

/**
 * Hybrid search: keyword and embedding in parallel, keyword order kept, new
 * semantic hits appended, sliced to the requested page.
 *
 * ## `department` is the only filter, and it is deliberate
 *
 * There used to be a second one — a minimum-rating dropdown, "at least N
 * stars", thresholding the learning mean. It has been removed. It was in no
 * artboard: `docs/design_ref/2026-09-06/Course Community - Explore.dc.html`
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
 * left with the feature, and the over-fetch went with it.
 *
 * `department` stays, and is still a deviation from the artboard — but a cheap
 * and honest one. It filters in SQL (`department ILIKE`, in the repository),
 * so the database does the narrowing, every returned row already satisfies it,
 * and it applies to the whole window rather than to one page. That is what
 * makes it survive paging: page 3 of a filtered search is page 3 of the
 * filtered ranking, not page 3 of an unfiltered one with rows knocked out.
 *
 * ## Paging with a lookahead, because there is no total to have
 *
 * `total` used to be returned here as `results.length` — the size of what had
 * just been returned, which is not a total of anything. It is gone rather than
 * corrected, because the honest version cannot be computed:
 *
 * - the result set is the union of two independent rankings, de-duplicated in
 *   application code, so neither leg's count is the answer and the union's
 *   cannot be had without running both across the whole catalogue; and
 * - the semantic leg has no cutoff — every course with an embedding matches at
 *   some distance — so "how many match" has no answer short of "all of them".
 *
 * A prev/next pager never needed one. "How many results are there" is expensive
 * and close to meaningless for a hybrid ranking; **"is there another page" is
 * one extra row.** So this fetches `(page * size) + 1` and reports whether the
 * extra row came back. One query per leg, exactly as before, one row wider.
 *
 * ## Why a wider fetch gives the same page
 *
 * Paging by re-fetching the whole prefix works only if the prefix is stable —
 * page 2 of a 41-row fetch must hold the rows page 2 of a 61-row fetch holds.
 * It does, for two reasons that have to hold together:
 *
 * - each leg is a LIMIT over a *totally* ordered query, so a wider LIMIT
 *   returns a superset beginning with the narrower one. The keyword leg has
 *   always ended `courses.code ASC`; the semantic leg does now, and #148 is
 *   where that was fixed — ordering on distance alone let equidistant rows
 *   swap between two fetches, which puts a course on two pages or on none.
 * - the union of the two is itself prefix-stable. Where the keyword leg fills
 *   the window, the first `size` rows *are* keyword rows and the semantic leg
 *   cannot reach them; where it does not fill the window, it is exhausted and
 *   identical at every width, so the semantic tail extends rather than shifts.
 *
 * One honest caveat. The semantic leg reads an HNSW index, which is approximate
 * and whose search list widens with the LIMIT, so its prefix is stable in
 * practice rather than by construction — `repository.ts` says what the tiebreak
 * does and does not buy. The exposure is bounded twice over: the keyword leg is
 * exact and comes first, so only the tail of a deep page is ANN-ordered at all;
 * and `MAX_SEARCH_PAGES` keeps the widest window this domain ever asks for at
 * 101 rows, which over a catalogue this size is well inside where an HNSW scan
 * and an exact one agree.
 *
 * The cost of the whole scheme is a discarded prefix: page 5 fetches 101 rows
 * and drops 80. At this catalogue size that is cheap, and `MAX_SEARCH_PAGES`
 * bounds it.
 */
export async function searchCourses(
  query: string,
  options: SearchPageRequest = {},
): Promise<SearchPage> {
  const page = clampPage(options.page);
  if (!query?.trim()) return { results: [], page, hasMore: false };

  const size = options.size ?? DEFAULT_SEARCH_PAGE_SIZE;
  const departmentFilter = resolveDepartmentFilter(options.department);
  const offset = (page - 1) * size;

  // One row past the end of this page, which is the whole of "is there a next
  // page". At the cap there is no next page to ask about, so the row is not
  // fetched and `hasMore` falls out false on its own rather than being
  // special-cased below.
  const lookahead = page < MAX_SEARCH_PAGES ? 1 : 0;
  const fetchWindow = offset + size + lookahead;

  const [keywordHits, semanticHits] = await Promise.all([
    searchByKeyword(query, fetchWindow, departmentFilter),
    searchWithEmbedding(query, fetchWindow, departmentFilter),
  ]);

  const seen = new Set(keywordHits.map((h) => h.courseCode));
  const ranked = [
    ...keywordHits,
    ...semanticHits.filter((h) => !seen.has(h.courseCode)),
  ].slice(0, fetchWindow);

  // Read off the ranking, not off `results`: `getSummariesByCodes` drops a code
  // whose course row has gone, so a page can come back short of the rows that
  // were ranked behind it. Whether a next page exists is a fact about the
  // ranking.
  const hasMore = ranked.length > offset + size;
  const codes = ranked.slice(offset, offset + size).map((h) => h.courseCode);

  if (codes.length === 0) return { results: [], page, hasMore };

  return { results: await getSummariesByCodes(codes), page, hasMore };
}

export function getDepartments(): Promise<string[]> {
  return listDepartments();
}
