import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AuthProviders } from "./auth-providers";

export function Auth() {
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
              <AuthProviders />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
