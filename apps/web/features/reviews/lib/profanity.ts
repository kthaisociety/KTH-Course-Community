import profoundWords from "profane-words";
import { toPlainText } from "./review-text";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Which banned words a draft message contains, matched on whole words so that
 * an innocent word merely containing one is left alone. Shared by writing a
 * review and editing one, so the same draft is judged the same way either way.
 *
 * A client-side courtesy check, not a moderation boundary.
 */
export function findProfanity(html: string): string[] {
  const plainText = toPlainText(html);
  return profoundWords
    .filter(Boolean)
    .filter((badWord) =>
      new RegExp(`\\b${escapeRegex(String(badWord))}\\b`, "i").test(plainText),
    );
}
