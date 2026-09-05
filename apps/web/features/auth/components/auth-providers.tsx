"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GithubIcon, GoogleIcon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import type { OauthProvider } from "@/types";
import { requestedReturnTo } from "../lib/return-to";

export function AuthProviders() {
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
        // `?next=` if `AuthReasonDialog` sent them here, `/search` otherwise —
        // the same promise the dialog's own buttons make, kept by the page it
        // hands off to.
        callbackURL: requestedReturnTo(),
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
    <div className="grid grid-cols-2 gap-4">
      <Button
        disabled={isLoading}
        variant="outline"
        type="button"
        className="w-full"
        onClick={() => handleSubmit("google")}
      >
        {isLoading && providerClicked === "google" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <GoogleIcon />
        )}
        Google
      </Button>
      <Button
        disabled={isLoading}
        variant="outline"
        type="button"
        className="w-full"
        onClick={() => handleSubmit("github")}
      >
        {isLoading && providerClicked === "github" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <GithubIcon />
        )}
        GitHub
      </Button>
    </div>
  );
}
