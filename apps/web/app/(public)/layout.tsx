import type { ReactNode } from "react";
import { AppShell } from "@/features/shell";

/**
 * The public pages render in the same frame as the rest of the app: the designed
 * rail carries its own signed-out state, so there is one frame and a visitor
 * keeps the whole of it rather than being given different chrome.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
