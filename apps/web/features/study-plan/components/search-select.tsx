"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  /** The name, e.g. "Degree Programme in Computer Science". */
  label: string;
  /** A short code shown in mono before the name, e.g. "CDATE". */
  code?: string;
  /** A quiet note after the name, e.g. "no intake after HT 2025". */
  hint?: string;
};

export type SelectGroup = { heading?: string; options: SelectOption[] };

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  groups: SelectGroup[];
  /** What the closed field says before anything is chosen. */
  placeholder: string;
  /** A first option that clears the choice, e.g. "Not chosen yet". */
  noneLabel?: string;
  /** Long lists (every programme, every master's) get a search field; short ones don't. */
  searchable?: boolean;
  searchPlaceholder?: string;
};

/**
 * A field that opens a list in the app's own colours: the native select it
 * replaces drew its options light on white in the dark theme, and made a
 * student scroll a hundred programmes to find theirs. Typing narrows the list
 * by code or name; arrows and Enter pick, Escape closes.
 */
export function SearchSelect({
  id,
  value,
  onChange,
  groups,
  placeholder,
  noneLabel,
  searchable = false,
  searchPlaceholder = "Search by code or name",
}: Props) {
  const [open, setOpen] = useState(false);
  const chosen = groups
    .flatMap((g) => g.options)
    .find((o) => o.value === value);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const item =
    "flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-cc-ink outline-none data-[selected=true]:bg-cc-pill";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-[10px] border border-cc-rule2 bg-cc-surface px-3 text-left text-[13.5px] outline-none hover:bg-cc-pill/50 focus-visible:ring-[3px] focus-visible:ring-cc-focus/30 data-[state=open]:ring-[3px] data-[state=open]:ring-cc-focus/20",
        )}
      >
        {chosen ? (
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            {chosen.code ? (
              <span className="shrink-0 font-mono text-[12px] text-cc-brand">
                {chosen.code}
              </span>
            ) : null}
            <span className="truncate text-cc-ink">{chosen.label}</span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-cc-muted">
            {placeholder}
          </span>
        )}
        <ChevronDown aria-hidden size={15} className="shrink-0 text-cc-muted" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] overflow-hidden rounded-[14px] border border-cc-rule bg-cc-surface p-0 text-cc-ink shadow-[0_18px_48px_-12px_rgba(20,30,45,0.45)] ring-0"
      >
        <Command
          // Matches the code or any word of the name, so "data" finds CDATE and "cdate" does too.
          filter={(itemValue, search, keywords) => {
            const hay = [itemValue, ...(keywords ?? [])]
              .join(" ")
              .toLowerCase();
            return search
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean)
              .every((w) => hay.includes(w))
              ? 1
              : 0;
          }}
          tabIndex={searchable ? undefined : 0}
          className="outline-none"
        >
          {searchable ? (
            // `data-cc-field` turns off the input's own focus ring, which drew a box
            // inside the box; the row's bottom rule takes the focus colour instead.
            <div className="flex items-center gap-2 border-cc-rule border-b px-3 transition-colors has-[input:focus-visible]:border-cc-focus">
              <Search
                aria-hidden
                size={15}
                className="shrink-0 text-cc-muted"
              />
              <Command.Input
                data-cc-field
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-[13px] text-cc-ink outline-none placeholder:text-cc-muted"
              />
            </div>
          ) : null}
          <Command.List className="scrollbar-subtle max-h-[min(360px,calc(var(--radix-popover-content-available-height)-56px))] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-[12.5px] text-cc-muted">
              Nothing matches.
            </Command.Empty>
            {noneLabel ? (
              <Command.Item
                value="__none__"
                onSelect={() => pick("")}
                className={cn(item, "text-cc-muted")}
              >
                <span className="flex-1">{noneLabel}</span>
                {value === "" ? (
                  <Check aria-hidden size={14} className="text-cc-brand" />
                ) : null}
              </Command.Item>
            ) : null}
            {groups.map((g, gi) => (
              <Command.Group
                key={g.heading ?? gi}
                heading={g.heading}
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-cc-muted"
              >
                {g.options.map((o) => (
                  <Command.Item
                    key={o.value}
                    value={o.value}
                    keywords={[o.label, o.code ?? "", o.hint ?? ""]}
                    onSelect={() => pick(o.value)}
                    className={item}
                  >
                    {o.code ? (
                      <span className="w-[50px] shrink-0 font-mono text-[11.5px] text-cc-brand">
                        {o.code}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.hint ? (
                        <span className="block truncate text-[11px] text-cc-muted">
                          {o.hint}
                        </span>
                      ) : null}
                    </span>
                    {o.value === value ? (
                      <Check
                        aria-hidden
                        size={14}
                        className="shrink-0 text-cc-brand"
                      />
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
