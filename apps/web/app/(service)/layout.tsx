import type React from "react";
import { AppShell } from "@/features/shell/components/app-shell";

export default function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
