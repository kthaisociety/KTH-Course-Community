import { listSavedCourseCodes } from "../saved/service";
import * as userRepo from "./repository";

export type Me = {
  userId: string;
  name: string;
  email: string;
  savedCourseCodes: string[];
  image: string | null;
};

/** Cross-domain read: saved courses belong to the saved domain. */
export function getSavedCourseCodes(id: string): Promise<string[]> {
  return listSavedCourseCodes(id);
}

export function updateImage(id: string, imageURL: string) {
  return userRepo.updateImage(id, imageURL);
}

export function deleteUser(id: string): Promise<void> {
  return userRepo.deleteById(id);
}
