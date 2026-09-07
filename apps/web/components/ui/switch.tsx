"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        /*
          The artboard's switch: a 42×24 track at a 99px radius with 3px of
          inset, holding an 18px round thumb that travels 18px.
          `Course Community - My Page.dc.html` draws both of them.

          The stock metrics were 32×18.4 with a 16px thumb and a
          `calc(100%-2px)` travel that worked out to 14px, so every number was
          wrong and the shape read as a different control. Padding is `p-[2px]`
          rather than `p-[3px]` because `border border-transparent` is already
          contributing 1px per side and the box is `border-box`: 1 + 2 gives the
          3px the artboard insets by. The travel then falls out of the geometry —
          42 − 2 (border) − 4 (padding) − 18 (thumb) = 18 — rather than being a
          separate number to keep in step.

          `sm` is scaled from the same proportions (7/12ths, giving 24×14 with a
          10px thumb) and has no consumer today; it is kept in step so that the
          first one does not inherit the metrics this commit removed.

          ## The state variants are `data-[state=…]`, and that is load-bearing

          This is **Radix**, which marks state as `data-state="checked"` /
          `data-state="unchecked"`. It previously used `data-checked:` and
          `data-unchecked:` — Base UI's convention, and what shadcn's Base UI
          switch ships — so not one state-dependent class ever matched. The
          track had no colour in either state and the thumb never travelled:
          measured on `/profile`, both switches drew a transparent track under a
          `--cc-pg` thumb, on a white card, which is why they were nearly
          invisible. Callers could not override it either, because a caller's
          `data-unchecked:bg-…` missed for exactly the same reason.

          ## The colours are `--cc-*`, so callers pass nothing

          `bg-primary` / `bg-input` are shadcn's tokens and are not this app's.
          The track is the artboard's own pair — `--cc-btn` filled, `--cc-rule3`
          empty — and the thumb is `--cc-surface` rather than `--background`, so
          it stays the panel's white against the page's cream. That is the
          switch `transcript-drop-zone.tsx` had hand-rolled beside this one;
          there is now one switch in the app and it is this.
        */
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent p-[2px] transition-all outline-none group-has-[:focus-visible]/field-label:border-transparent group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[24px] data-[size=default]:w-[42px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:bg-cc-btn data-[state=unchecked]:bg-cc-rule3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        // `shadow-[0_1px_2px_rgba(20,30,45,.28)]` is the artboard's own, and is
        // what makes the thumb read as sitting on the track rather than cut out
        // of it. The stock thumb had `ring-0` and no shadow at all.
        className="pointer-events-none block rounded-full bg-cc-surface shadow-[0_1px_2px_rgba(20,30,45,0.28)] transition-transform group-data-[size=default]/switch:size-[18px] group-data-[size=sm]/switch:size-[10px] group-data-[size=default]/switch:data-[state=checked]:translate-x-[18px] group-data-[size=sm]/switch:data-[state=checked]:translate-x-[10px] group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
