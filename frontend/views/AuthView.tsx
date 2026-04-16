// frontend/views/AuthView.tsx

import type { OauthProvider } from "@shared/types";
import {
  AppleIcon,
  FacebookIcon,
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
import { cn } from "@/lib/utils";

type AuthViewProps = {
  onSubmit: (provider: OauthProvider) => void;
  isLoading: boolean;
  providerClicked: OauthProvider | null;
};

export default function AuthView({
  onSubmit,
  isLoading,
  providerClicked,
}: AuthViewProps) {
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
                      onClick={() => onSubmit("apple")}
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
                      onClick={() => onSubmit("google")}
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
                      onClick={() => onSubmit("facebook")}
                    >
                      <FacebookIcon />
                      {isLoading && providerClicked === "facebook" ? (
                        <Spinner variant="ring" />
                      ) : (
                        "Login with Facebook"
                      )}
                    </Button>
                    <Button
                      disabled={isLoading}
                      variant="outline"
                      type="button"
                      className="w-full"
                      onClick={() => onSubmit("github")}
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
                      onClick={() => onSubmit("microsoft")}
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
