import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthProviders } from "./auth-providers";
import { MagicLinkForm } from "./magic-link-form";

export function Auth({ error }: { error?: string }) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome!</CardTitle>
            <CardDescription>
              Sign in with Google, GitHub, or email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>
                    This sign-in link is invalid or has expired. Request a new
                    one.
                  </AlertDescription>
                </Alert>
              ) : null}
              <AuthProviders />
              <div className="relative text-center text-sm after:absolute after:inset-x-0 after:top-1/2 after:border-t after:border-border">
                <span className="bg-card text-muted-foreground relative z-10 px-2">
                  Or continue with email
                </span>
              </div>
              <MagicLinkForm />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
