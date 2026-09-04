"use client";

import { MoreHorizontal } from "lucide-react";
import { usePopover } from "@/features/collections/hooks/use-popover";
import { useRenameDraft } from "@/features/collections/hooks/use-rename-draft";
import type { Collection } from "@/features/courses";

type Props = {
  collection: Collection;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

/**
 * One collection as a 40px chip — the `compact` variant's answer to
 * {@link CollectionTile}.
 *
 * `Course Community - Collections.dc.html` line 174 draws this row when the
 * artboard is embedded rather than shown as a page, which is how
 * `Course Community - Saved.dc.html` reaches collections at all. A chip is the
 * tile with everything but the name, the count and the menu taken out: the
 * section is a strip above a list of cards, not the page's subject, so course
 * previews would be the second-biggest thing on the screen.
 *
 * The menu and the rename draft are the chip's own state for the reason the
 * tile's are — a deleted collection unmounts its instance, and state the parent
 * held keyed by id would have to be cleaned up by hand.
 */
export function CollectionChip({
  collection,
  onOpen,
  onRename,
  onDelete,
}: Props) {
  const menu = usePopover();
  const renaming = useRenameDraft(collection.name, onRename);

  return (
    <div className="relative box-border flex h-10 flex-none items-center gap-[9px] whitespace-nowrap rounded-[9px] border border-cc-rule bg-cc-surface px-3 hover:border-cc-hov">
      {/* The whole chip opens the collection, as the artboard's does. A button
          covering it keeps the name and count as text rather than nesting a
          second control inside a control. */}
      {renaming.isRenaming ? null : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open collection ${collection.name}`}
          className="absolute inset-0 cursor-pointer rounded-[9px]"
        />
      )}

      {renaming.isRenaming ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: Rename put the caret here, as the artboard's own autoFocus does.
          autoFocus
          aria-label="Collection name"
          value={renaming.draft}
          onChange={(event) => renaming.change(event.target.value)}
          onBlur={renaming.commit}
          onKeyDown={renaming.onKeyDown}
          className="box-border h-[26px] w-[120px] rounded-[6px] border border-cc-brand bg-cc-surface px-[7px] font-semibold text-[13px] text-cc-ink outline-none"
        />
      ) : (
        <span className="pointer-events-none max-w-[160px] truncate font-semibold text-[13px]">
          {collection.name}
        </span>
      )}

      <span className="pointer-events-none text-[12px] text-cc-dim2">
        {collection.courseCodes.length}
      </span>

      <div className="relative flex-none">
        <button
          ref={menu.triggerRef}
          type="button"
          onClick={menu.toggle}
          aria-label={`More actions for ${collection.name}`}
          aria-haspopup="menu"
          aria-expanded={menu.isOpen}
          title={`More actions for ${collection.name}`}
          className="flex size-[22px] cursor-pointer items-center justify-center rounded-[6px] text-cc-dim hover:bg-cc-pill"
        >
          <MoreHorizontal size={15} aria-hidden />
        </button>

        {menu.isOpen ? (
          <div
            ref={menu.panelRef}
            role="menu"
            aria-label={`Actions for ${collection.name}`}
            className="absolute top-[30px] right-0 z-20 w-[150px] rounded-[9px] border border-cc-rule2 bg-cc-surface p-1 shadow-[0_8px_24px_rgba(20,30,45,.14)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                menu.close();
                renaming.start();
              }}
              className="block w-full cursor-pointer rounded-[6px] px-[9px] py-2 text-left text-[12.5px] text-cc-ink2 hover:bg-cc-pill"
            >
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                menu.close();
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
  );
}
