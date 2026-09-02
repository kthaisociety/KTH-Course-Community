"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Topbar from "@/components/Topbar";
import { useSessionData } from "@/features/auth";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { LandingView } from "./landing-view";

export function LandingScreen() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isPending } = useSessionData();

  function onSubmit() {
    if (isAuthenticated) {
      router.push("/search");
    } else {
      setIsLoggingIn(true);
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (isLoggingIn) {
    return <AuthScreen />;
  }
  return (
    <div>
      <Topbar />
      <LandingView onSubmit={onSubmit} />
    </div>
  );
}
