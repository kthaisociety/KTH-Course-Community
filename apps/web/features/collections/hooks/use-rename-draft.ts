"use client";

import type { KeyboardEvent } from "react";
import { useCallback, useState } from "react";

/**
 * Renaming a collection in place, as both the tile and the detail header do it.
 *
 * The draft is `null` until Rename opens it, which is what separates "not
 * renaming" from "renaming to the empty string" — the second is a name the
 * server would reject, so it commits nothing rather than sending it.
 *
 * Escape clears the draft before the field can blur, so the blur that follows
 * commits nothing. Enter blurs, and the blur commits: one path, whichever way
 * the reader leaves the field.
 */
export function useRenameDraft(
  currentName: string,
  onRename: (name: string) => void,
) {
  const [draft, setDraft] = useState<string | null>(null);

  const cancel = useCallback(() => setDraft(null), []);

  const commit = useCallback(() => {
    const name = draft?.trim() ?? "";
    setDraft(null);
    if (name && name !== currentName) onRename(name);
  }, [draft, currentName, onRename]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") setDraft(null);
  }, []);

  return {
    /** The text in the field. Meaningless while `isRenaming` is false. */
    draft: draft ?? "",
    isRenaming: draft !== null,
    start: () => setDraft(currentName),
    change: (name: string) => setDraft(name),
    commit,
    cancel,
    onKeyDown,
  };
}
