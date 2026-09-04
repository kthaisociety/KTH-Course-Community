import { nanoid } from "nanoid";
import { ForbiddenError, NotFoundError } from "../errors";
import { isCourseSaved } from "../saved/service";
import * as collectionsRepo from "./repository";

/**
 * A named, ordered group of one app user's saved courses. `createdAt` is an ISO
 * string because the tRPC link carries no transformer.
 */
export type Collection = {
  id: string;
  name: string;
  createdAt: string;
  courseCodes: string[];
};

function toCollection(
  row: collectionsRepo.CollectionRecord,
  courseCodes: string[],
): Collection {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    courseCodes,
  };
}

export async function listCollections(userId: string): Promise<Collection[]> {
  const [rows, memberships] = await Promise.all([
    collectionsRepo.listCollections(userId),
    collectionsRepo.listCollectionCoursesForUser(userId),
  ]);

  const byCollection = new Map<string, collectionsRepo.CollectionCourseRow[]>();
  for (const membership of memberships) {
    const bucket = byCollection.get(membership.collectionId);
    if (bucket) bucket.push(membership);
    else byCollection.set(membership.collectionId, [membership]);
  }

  return rows.map((row) =>
    toCollection(
      row,
      (byCollection.get(row.id) ?? [])
        .sort(
          (a, b) =>
            a.position - b.position || a.courseCode.localeCompare(b.courseCode),
        )
        .map((membership) => membership.courseCode),
    ),
  );
}

export async function createCollection(
  userId: string,
  name: string,
): Promise<Collection> {
  const row = await collectionsRepo.insertCollection({
    id: nanoid(),
    userId,
    name,
  });
  return toCollection(row, []);
}

export async function renameCollection(
  userId: string,
  collectionId: string,
  name: string,
): Promise<Collection> {
  await assertOwned(userId, collectionId);
  const row = await collectionsRepo.updateCollectionName(
    userId,
    collectionId,
    name,
  );
  if (!row) throw noSuchCollection(collectionId);
  const courseCodes = await collectionsRepo.listCourseCodes(collectionId);
  return toCollection(row, courseCodes);
}

export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<{ id: string }> {
  await assertOwned(userId, collectionId);
  await collectionsRepo.deleteCollection(userId, collectionId);
  return { id: collectionId };
}

/**
 * A course may only join a collection if the same user has also saved it. The
 * composite foreign keys enforce that too, but the check here fails cleanly
 * instead of surfacing a constraint violation.
 */
export async function addCourseToCollection(
  userId: string,
  collectionId: string,
  courseCode: string,
): Promise<{ collectionId: string; courseCode: string }> {
  await assertOwned(userId, collectionId);
  if (!(await isCourseSaved(userId, courseCode))) {
    throw new ForbiddenError(
      `Save ${courseCode} before adding it to a collection`,
    );
  }
  // Position allocation belongs to the repository: appending safely means
  // reading the last position and inserting inside one locked transaction.
  await collectionsRepo.appendCollectionCourse({
    collectionId,
    collectionUserId: userId,
    courseCode,
  });
  return { collectionId, courseCode };
}

export async function removeCourseFromCollection(
  userId: string,
  collectionId: string,
  courseCode: string,
): Promise<{ collectionId: string; courseCode: string }> {
  await assertOwned(userId, collectionId);
  const deleted = await collectionsRepo.deleteCollectionCourse(
    collectionId,
    courseCode,
  );
  if (!deleted) {
    throw new NotFoundError(
      `Course ${courseCode} is not in collection ${collectionId}`,
    );
  }
  return { collectionId, courseCode };
}

/**
 * Rewrites the collection's order. `courseCodes` may be a prefix: any member it
 * leaves out keeps its relative order behind the ones it names.
 */
export async function reorderCollectionCourses(
  userId: string,
  collectionId: string,
  courseCodes: string[],
): Promise<{ collectionId: string; courseCodes: string[] }> {
  await assertOwned(userId, collectionId);
  const current = await collectionsRepo.listCourseCodes(collectionId);
  const members = new Set(current);

  const requested: string[] = [];
  for (const courseCode of courseCodes) {
    if (!members.has(courseCode)) {
      throw new NotFoundError(
        `Course ${courseCode} is not in collection ${collectionId}`,
      );
    }
    if (!requested.includes(courseCode)) requested.push(courseCode);
  }

  const listed = new Set(requested);
  const ordered = [
    ...requested,
    ...current.filter((courseCode) => !listed.has(courseCode)),
  ];
  await collectionsRepo.setCoursePositions(collectionId, ordered);
  return { collectionId, courseCodes: ordered };
}

async function assertOwned(
  userId: string,
  collectionId: string,
): Promise<collectionsRepo.CollectionRecord> {
  const row = await collectionsRepo.findCollection(userId, collectionId);
  if (!row) throw noSuchCollection(collectionId);
  return row;
}

/**
 * Someone else's collection is reported as missing rather than forbidden: a
 * collection is private, so its existence is not the caller's to learn.
 */
function noSuchCollection(collectionId: string): NotFoundError {
  return new NotFoundError(`Collection ${collectionId} not found`);
}
