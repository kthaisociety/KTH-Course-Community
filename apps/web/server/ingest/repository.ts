import { inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { courseExplore } from "../db/schema";

export async function findCourseExploreSourceHashes(
  courseCodes: string[],
): Promise<Map<string, string | null>> {
  if (courseCodes.length === 0) return new Map();

  const rows = await db
    .select({
      courseCode: courseExplore.courseCode,
      sourceHash: courseExplore.sourceHash,
    })
    .from(courseExplore)
    .where(inArray(courseExplore.courseCode, courseCodes));

  return new Map(rows.map((row) => [row.courseCode, row.sourceHash]));
}

export async function upsertCourseExploreSearchState(input: {
  courseCode: string;
  embedding: number[];
  sourceHash: string;
  searchText: string;
  embeddingModel: string;
}): Promise<void> {
  await db
    .insert(courseExplore)
    .values({
      courseCode: input.courseCode,
      embedding: sql`${JSON.stringify(input.embedding)}::vector`,
      sourceHash: input.sourceHash,
      searchVector: sql`to_tsvector('simple', ${input.searchText})`,
      embeddingModel: input.embeddingModel,
      embeddedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: courseExplore.courseCode,
      set: {
        embedding: sql`excluded.embedding`,
        sourceHash: sql`excluded.source_hash`,
        searchVector: sql`excluded.search_vector`,
        embeddingModel: sql`excluded.embedding_model`,
        embeddedAt: sql`excluded.embedded_at`,
        updatedAt: sql`now()`,
      },
    });
}
