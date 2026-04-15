// frontend/controllers/AuthController.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ThirdParty from "supertokens-auth-react/recipe/thirdparty";
import type { OauthProvider } from "@shared/types";
import { initST } from "../lib/supertokens.client";
import AuthView from "../views/AuthView";

function AuthController() {
  const router = useRouter();

  useEffect(() => {
    initST();
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [providerClicked, setProviderClicked] = useState<OauthProvider | null>(
    null,
  );

  async function handleSubmit(provider: OauthProvider) {
    setIsLoading(true);
    setProviderClicked(provider);
    try {
      // Build callback like /auth/callback/google, /auth/callback/github, etc.
      const frontendRedirectURI = `${location.origin}/auth/callback/${provider}`;
      // Fix later, only implement google for now
      if (provider === "google") {
        const url =
          await ThirdParty.getAuthorisationURLWithQueryParamsAndSetState({
            thirdPartyId: provider,
            frontendRedirectURI,
          });
        router.push(url);
      } else {
        toast.error(`${provider} is not supported yet`);
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
