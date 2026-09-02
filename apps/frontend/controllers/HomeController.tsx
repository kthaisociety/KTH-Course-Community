"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Topbar from "@/components/Topbar";
import { useMe } from "@/hooks/useMe";
import LandingPageView from "@/views/LandingPageView";
import AuthController from "./AuthController";

export default function HomeController() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isLoading } = useMe();

  function onSubmit() {
    if (isAuthenticated) {
      router.push("/search");
    } else {
      setIsLoggingIn(true);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (isLoggingIn) {
    return <AuthController />;
  }
  return (
    <div>
      <Topbar />
      <LandingPageView onSubmit={onSubmit} />
    </div>
  );
}
