"use client";

import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { useSessionData } from "@/features/auth";

export function PublicChrome({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSessionData();

  return (
    <div className="min-h-screen flex">
      {isAuthenticated ? (
        <aside className="xl:w-80 md:w-50 w-50 fixed h-full">
          <Navbar />
        </aside>
      ) : (
        <Topbar />
      )}
      <main
        className={`flex-1 min-h-screen overflow-auto ${
          isAuthenticated ? "ml-50 xl:ml-80 md:ml-50 " : "pt-20"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
