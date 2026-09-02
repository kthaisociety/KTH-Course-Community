import { Loader2 } from "lucide-react";

export default function OAuthCallbackView() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Signing you in...
          </h1>
          <p className="text-muted-foreground">
            Please wait while we complete your authentication
          </p>
        </div>
      </div>
    </div>
  );
}
