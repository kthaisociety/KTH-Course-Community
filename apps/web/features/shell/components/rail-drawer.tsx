"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { AuthReason } from "@/features/auth";
import { Rail } from "@/features/shell/components/rail";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ask the page to open the sign-in dialog. */
  onRequestAuth: (reason: AuthReason) => void;
};

/**
 * The rail as a drawer, for a frame too narrow to keep it in the flow.
 *
 * One component because two pages open it: the app shell behind its topbar's
 * menu button, and the landing page, which has no rail of its own (#252). Both
 * must slide out the same rail at the same width, and the sign-in its footer
 * asks for belongs to whichever page opened it.
 */
export function RailDrawer({ open, onOpenChange, onRequestAuth }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        overlayClassName="bg-[rgba(20,30,45,0.4)] supports-backdrop-filter:backdrop-blur-none"
        className="w-[250px] max-w-[85vw] gap-0 border-none bg-cc-rail p-0 sm:max-w-[250px]"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <Rail
          onRequestAuth={onRequestAuth}
          onDismiss={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
