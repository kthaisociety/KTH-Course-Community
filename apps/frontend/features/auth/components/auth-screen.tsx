"use client";

import type { OauthProvider } from "@shared/types";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { AuthView } from "./auth-view";

export function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [providerClicked, setProviderClicked] = useState<OauthProvider | null>(
    null,
  );

  async function handleSubmit(provider: OauthProvider) {
    setIsLoading(true);
    setProviderClicked(provider);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/search",
      });
      if (error) {
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
