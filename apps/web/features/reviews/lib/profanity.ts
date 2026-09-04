import profoundWords from "profane-words";
import { toast } from "sonner";
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

/**
 * Whether a draft has to go back for rewording, telling the writer why if so.
 * Writing a review and editing one ask the same question and get the same
 * answer in the same words, which is the point of it living here.
 */
export function warnAboutProfanity(html: string): boolean {
  const matches = findProfanity(html);
  if (matches.length === 0) return false;
  toast("Please refrain from using profane language", {
    description: `Dissaproved words: ${matches.join(", ")}`,
  });
  return true;
}
