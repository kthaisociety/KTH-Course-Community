"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout";
import Topbar from "@/components/Topbar";
import { useSessionData } from "@/features/auth";

export function PublicChrome({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSessionData();

  if (isAuthenticated) {
    return <AppShell>{children}</AppShell>;
  }

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="min-h-screen overflow-auto pt-20">{children}</main>
    </div>
  );
}
