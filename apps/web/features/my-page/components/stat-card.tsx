type Props = {
  label: string;
  value: string;
  /** The unit that trails the figure, set smaller — the artboard's "hp". */
  unit?: string;
  note: string;
  /**
   * The artboard tints only the average card, and only when there is a real
   * average to show. A card with an em dash in it is not worth highlighting.
   */
  emphasis?: boolean;
};

/** One of the Overview tab's four figures. */
export function StatCard({
  label,
  value,
  unit,
  note,
  emphasis = false,
}: Props) {
  return (
    <div
      className={`rounded-xl border px-[17px] py-4 ${
        emphasis
          ? "border-cc-hov bg-cc-info-solid"
          : "border-cc-rule bg-cc-surface"
      }`}
    >
      <div className="font-medium text-[11.5px] text-cc-dim">{label}</div>
      <div
        className={`mt-[7px] font-semibold text-[28px] tracking-[-0.02em] tabular-nums ${
          emphasis ? "text-cc-brand" : ""
        }`}
      >
        {value}
        {unit ? (
          <span className="ml-1 font-medium text-[15px] text-cc-dim">
            {unit}
          </span>
        ) : null}
      </div>
      <div className="mt-[5px] text-[12px] text-cc-dim2">{note}</div>
    </div>
  );
}
