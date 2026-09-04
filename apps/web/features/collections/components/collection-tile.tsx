"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  courseCountLabel,
  overflowLabel,
  TILE_PREVIEW_LIMIT,
} from "@/features/collections/lib/collection-model";
import type { Collection, CourseCardCourse } from "@/features/courses";

type Props = {
  collection: Collection;
  /** The catalogue entry behind a course code, once its summary has loaded. */
  courseFor: (courseCode: string) => CourseCardCourse | undefined;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

/**
 * One collection in the grid: its name, the first few courses in it, and the
 * menu that renames or deletes it.
 *
 * The menu and the rename draft are the tile's own state rather than the page's,
 * for the reason `CourseCardItem` carries its picker: state held by the page and
 * keyed by collection id has to be cleaned up when a collection is deleted, and
 * a keyed component instance does that by unmounting.
 *
 * The whole tile opens the collection, as the artboard's does, so the click
 * target is a button covering it rather than the name alone — the previews and
 * the count are text, and text inside a button is what a nested `role="button"`
 * would have made unreadable to a screen reader. The menu sits above it.
 *
 * The artboard's tile also has a "last updated" line in its footer. `collections`
 * has `created_at` and no `updated_at`, and nothing in `server/` would write one,
 * so the footer carries only the count (#68).
 */
export function CollectionTile({
  collection,
  courseFor,
  onOpen,
  onRename,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // A menu left open behind a click elsewhere on the page would sit over the
  // next tile the reader reaches for; the artboard closes it on any pointer
  // down outside itself, and so does this.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

  function commitRename() {
    const name = draft?.trim() ?? "";
    setDraft(null);
    if (name && name !== collection.name) onRename(name);
  }

  const previews = collection.courseCodes.slice(0, TILE_PREVIEW_LIMIT);
  const overflow = overflowLabel(collection.courseCodes.length);
  const renaming = draft !== null;

  return (
    <div className="relative box-border flex min-h-[150px] flex-col gap-[9px] rounded-[11px] border border-cc-rule bg-cc-surface p-[14px_15px] hover:border-cc-hov">
      {renaming ? null : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open collection ${collection.name}`}
          className="absolute inset-0 cursor-pointer rounded-[11px]"
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-none min-w-0 flex-1">
          {renaming ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: the menu's Rename put the caret here, as the artboard's own autoFocus does.
              autoFocus
              aria-label="Collection name"
              value={draft ?? ""}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setDraft(null);
              }}
              className="pointer-events-auto box-border h-7 w-full rounded-[6px] border border-cc-brand bg-cc-surface px-2 font-semibold text-[13.5px] text-cc-ink outline-none"
            />
          ) : (
            <div className="truncate font-semibold text-[14px] leading-[1.3]">
              {collection.name}
            </div>
          )}
        </div>

        <div className="relative flex-none" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`More actions for ${collection.name}`}
            aria-expanded={menuOpen}
            title={`More actions for ${collection.name}`}
            className="flex size-[26px] cursor-pointer items-center justify-center rounded-[7px] text-cc-dim hover:bg-cc-pill"
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>

          {menuOpen ? (
            <div className="absolute top-[30px] right-0 z-20 w-[150px] rounded-[9px] border border-cc-rule2 bg-cc-surface p-1 shadow-[0_8px_24px_rgba(20,30,45,.14)]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setDraft(collection.name);
                }}
                className="block w-full cursor-pointer rounded-[6px] px-[9px] py-2 text-left text-[12.5px] text-cc-ink2 hover:bg-cc-pill"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="block w-full cursor-pointer rounded-[6px] px-[9px] py-2 text-left text-[12.5px] text-cc-danger hover:bg-[color-mix(in_srgb,var(--cc-danger)_12%,var(--cc-surface))]"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none flex flex-col gap-[3px]">
        {previews.map((courseCode) => (
          <div
            key={courseCode}
            className="flex items-baseline gap-[7px] text-[11.5px] text-cc-ink2"
          >
            <span className="font-mono text-[11px] text-cc-dim">
              {courseCode}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {courseFor(courseCode)?.titleEng ?? ""}
            </span>
          </div>
        ))}
        {overflow ? (
          <div className="font-medium text-[11.5px] text-cc-brand">
            {overflow}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none mt-auto flex items-baseline justify-end gap-2.5 text-[11px] text-cc-dim2">
        <span>{courseCountLabel(collection.courseCodes.length)}</span>
      </div>
    </div>
  );
}
