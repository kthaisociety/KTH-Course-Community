import type React from "react";
import AuthProvider from "@/providers/AuthProvider";
import Navbar from "../../components/Navbar";

export default function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex">
        <aside className="xl:w-80 md:w-50 w-50 fixed h-full">
          <Navbar />
        </aside>
        <main className="flex-1 ml-50 xl:ml-80 md:ml-50 overflow-auto">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
