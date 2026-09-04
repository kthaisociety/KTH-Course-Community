import type { ReactNode } from "react";

type Props = {
  title: string;
  body: ReactNode;
  /** The one thing there is to do here, when there is one. */
  action?: { label: string; onClick: () => void };
};

/**
 * The centred panel this page shows when there is nothing to list: no
 * collections, a collection with no courses in it, and a collection that is not
 * there at all.
 *
 * One component because the artboard draws one panel — `noCollections` in
 * `Course Community - Collections.dc.html` is the shape all three take, and
 * three copies of it would drift apart at the first change to its border.
 */
export function EmptyPanel({ title, body, action }: Props) {
  return (
    <div className="rounded-[11px] border border-cc-rule bg-cc-surface p-6 text-center">
      <div className="font-semibold text-[14.5px]">{title}</div>
      <div className="mt-[5px] text-[12.5px] text-cc-muted">{body}</div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mx-auto mt-[13px] flex h-[34px] w-max cursor-pointer items-center rounded-[9px] bg-cc-btn px-3.5 font-semibold text-[13px] text-cc-btn-fg hover:opacity-[0.88]"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
