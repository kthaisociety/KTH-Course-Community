"use client";

import { type ReactNode, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { getSession } from "@/state/session/sessionSlice";
import type { Dispatch, RootState } from "@/state/store";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<Dispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.session);

  useEffect(() => {
    dispatch(getSession());
  }, [dispatch]);

  return (
    <div className="min-h-screen flex">
      {isAuthenticated ? (
        // Authenticated, routed from (service), or pages with sidebar
        <aside className="xl:w-80 md:w-50 w-50 fixed h-full">
          <Navbar />
        </aside>
      ) : (
        // Not authenticated, routed from landing page
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
