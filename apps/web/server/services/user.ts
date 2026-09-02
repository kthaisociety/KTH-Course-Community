import * as userRepo from "../repositories/user";

export type Me = {
  userId: string;
  name: string;
  email: string;
  userFavorites: string[];
  image: string | null;
};

export function getUserFavorites(id: string): Promise<string[]> {
  return userRepo.listFavoriteCodes(id);
}

export async function toggleUserFavorite(userId: string, courseCode: string) {
  const existing = await userRepo.findFavorite(userId, courseCode);
  if (existing) {
    await userRepo.removeFavorite(userId, courseCode);
    return { action: "removed" as const };
  }
  await userRepo.addFavorite(userId, courseCode);
  return { action: "added" as const };
}

export function updateImage(id: string, imageURL: string) {
  return userRepo.updateImage(id, imageURL);
}

export function deleteUser(id: string): Promise<void> {
  return userRepo.deleteById(id);
}
