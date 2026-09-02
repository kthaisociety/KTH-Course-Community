import type React from "react";
import { AppShell } from "@/components/layout";

export default function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
