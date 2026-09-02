"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Topbar from "@/components/Topbar";
import { getSession } from "@/state/session/sessionSlice";
import type { Dispatch, RootState } from "@/state/store";
import LandingPageView from "@/views/LandingPageView";
import AuthController from "./AuthController";

export default function HomeController() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch<Dispatch>();

  const { isAuthenticated, isLoading } = useSelector(
    (state: RootState) => state.session,
  );

  useEffect(() => {
    // Check session on mount
    dispatch(getSession());
  }, [dispatch]);

  function onSubmit() {
    // If already authenticated, go directly to search
    if (isAuthenticated) {
      router.push("/search");
    } else {
      // Otherwise, show the auth flow
      setIsLoggingIn(true);
    }
  }

  // Show loading state while checking authentication
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
