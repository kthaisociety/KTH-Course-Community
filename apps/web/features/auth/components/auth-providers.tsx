"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GithubIcon, GoogleIcon } from "@/components/icon";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import type { OauthProvider } from "@/types";
import { requestedReturnTo } from "../lib/return-to";

/**
 * The design's **Secondary** control, from the "Controls" row of
 * `docs/design_ref/2026-09-06/Course Community - Design System.dc.html`: 38px
 * tall, 9px radius, 15px of side padding, `--rule3` around `--surface`, 13.5px
 * at 500 in `--ink`, and `--hov` on hover. shadcn's default button is 32px at a
 * 10px radius, which is what stood here and what nothing else in the app looks
 * like.
 *
 * Focus is `globals.css`'s, not this file's. It used to carry a
 * `focus-visible:border-cc-hov` plus a `ring-2`, on the stated grounds that the
 * artboards drew no focus state — true when it was written, and not true since
 * the 2026-09-06 export, whose `cc-theme.css` defines one treatment for
 * everything.
 */
const PROVIDER_BUTTON =
  "flex h-[38px] w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-cc-rule3 bg-cc-surface px-[15px] font-medium text-[13.5px] text-cc-ink outline-none hover:border-cc-hov disabled:cursor-not-allowed disabled:opacity-60 [&>svg]:size-4 [&>svg]:shrink-0";

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
    // Two words fit side by side in the card at any width worth calling a
    // phone, so they stay a pair and stack only when the card itself drops
    // under 20rem — a container query, because the card is what constrains
    // them and it is 400px wide long before the viewport is.
    <div className="grid grid-cols-1 gap-2 @xs:grid-cols-2">
      <button
        disabled={isLoading}
        type="button"
        className={PROVIDER_BUTTON}
        onClick={() => handleSubmit("google")}
      >
        {isLoading && providerClicked === "google" ? (
          <Spinner />
        ) : (
          <GoogleIcon />
        )}
        Google
      </button>
      <button
        disabled={isLoading}
        type="button"
        className={PROVIDER_BUTTON}
        onClick={() => handleSubmit("github")}
      >
        {isLoading && providerClicked === "github" ? (
          <Spinner />
        ) : (
          <GithubIcon />
        )}
        GitHub
      </button>
    </div>
  );
}
