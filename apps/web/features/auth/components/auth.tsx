"use client";

import type { OauthProvider } from "@shared/types";
import { useState } from "react";
import { toast } from "sonner";
import {
  AppleIcon,
  GithubIcon,
  GoogleIcon,
  MicrosoftIcon,
} from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function Auth() {
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
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className={cn("flex flex-col gap-6")}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Welcome!</CardTitle>
              <CardDescription>
                Login with your favourite provider
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form>
                <div className="grid gap-6">
                  <div className="flex flex-col gap-4">
                    <Button
                      disabled={isLoading}
                      variant="outline"
                      type="button"
                      className="w-full"
                      onClick={() => handleSubmit("apple")}
                    >
                      <AppleIcon />
                      {isLoading && providerClicked === "apple" ? (
                        <Spinner variant="ring" />
                      ) : (
                        "Login with Apple"
                      )}
                    </Button>
                    <Button
                      disabled={isLoading}
                      variant="outline"
                      type="button"
                      className="w-full"
                      onClick={() => handleSubmit("google")}
                    >
                      <GoogleIcon />
                      {isLoading && providerClicked === "google" ? (
                        <Spinner variant="ring" />
                      ) : (
                        "Login with Google"
                      )}
                    </Button>
                    <Button
                      disabled={isLoading}
                      variant="outline"
                      type="button"
                      className="w-full"
                      onClick={() => handleSubmit("github")}
                    >
                      <GithubIcon />
                      {isLoading && providerClicked === "github" ? (
                        <Spinner variant="ring" />
                      ) : (
                        "Login with Github"
                      )}
                    </Button>
                    <Button
                      disabled={isLoading}
                      variant="outline"
                      type="button"
                      className="w-full"
                      onClick={() => handleSubmit("microsoft")}
                    >
                      <MicrosoftIcon />
                      {isLoading && providerClicked === "microsoft" ? (
                        <Spinner variant="ring" />
                      ) : (
                        "Login with Microsoft"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
