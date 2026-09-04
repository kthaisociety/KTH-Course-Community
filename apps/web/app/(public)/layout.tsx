import type { ReactNode } from "react";
import { AppShell } from "@/features/shell";

/**
 * The public pages render in the same frame as the rest of the app. They used to
 * switch chrome on the session — a rail for members, a wordmark bar for everyone
 * else — but the designed rail carries its own signed-out state, so there is one
 * frame now and visitors keep the whole of it.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
