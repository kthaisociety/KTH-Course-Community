// frontend/controllers/AuthController.tsx
"use client";

import type { OauthProvider } from "@shared/types";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import AuthView from "../views/AuthView";

function AuthController() {
  const [isLoading, setIsLoading] = useState(false);
  const [providerClicked, setProviderClicked] = useState<OauthProvider | null>(
    null,
  );

  async function handleSubmit(provider: OauthProvider) {
    setIsLoading(true);
    setProviderClicked(provider);
    try {
      // Build callback like /auth/callback/google, /auth/callback/github, etc.
      // Only Google works for now, will throw error on everything else.
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/search", // where we route to after the login
      });
      if (error) {
        // if no error, only redirect happens.
        toast.error("Failed to sign in");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to sign in");
    } finally {
      setIsLoading(false);
      setProviderClicked(null);
    }
  }

  return (
    <AuthView
      onSubmit={handleSubmit}
      isLoading={isLoading}
      providerClicked={providerClicked}
    />
  );
}

export default AuthController;
