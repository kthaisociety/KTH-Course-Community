"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * **Find your dot**: the landing flow in which a member locates their own node.
 *
 * "Dot" is copy for this flow alone — the thing it finds is a **Node**, and the
 * panel never claims to have found one it did not.
 *
 * The artboard mocks this as a private link that reveals a dot without signing
 * anybody in. No such channel exists and nothing in `server/` could answer it,
 * so the private link here is the magic link Better Auth already sends: it
 * signs the member in and returns them to `/`, where the reveal runs against
 * `graph.neighbourhood` for real. The artboard's two "Prototype — simulate the
 * link" buttons go with the prototype.
 */

/** Where the flow has got to. The parent owns everything but the email form. */
export type FindYourDotStatus =
  /** No session: the dot belongs to an account, so ask for one. */
  | "sign-in"
  /** Came back through a link that had already been used, or timed out. */
  | "expired"
  /** Signed in, reading the neighbourhood. */
  | "locating"
  /** Read, and there is a node: it is drawn behind this panel. */
  | "placed"
  /** Read, and there is no node for this app user yet. */
  | "unplaced"
  /** The read failed for some other reason. */
  | "unavailable";

/** Where the private link comes back to, and what it says when it fails. */
export const DOT_CALLBACK = "/?dot=1";
export const DOT_ERROR_CALLBACK = "/?dot=expired";

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;

type Props = {
  open: boolean;
  status: FindYourDotStatus;
  onClose: () => void;
  /**
   * Start this over: from `expired` it asks for a fresh link, from
   * `unavailable` it reads the neighbourhood again.
   */
  onRetry: () => void;
};

export function FindYourDot({ open, status, onClose, onRetry }: Props) {
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // The reveal is the point: while the dot is on screen the panel steps aside
  // and the scrim lifts, exactly as the artboard does it.
  const revealing = status === "placed";

  async function sendLink() {
    const address = email.trim();
    if (!EMAIL.test(address)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setSending(true);
    const { error } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: DOT_CALLBACK,
      errorCallbackURL: DOT_ERROR_CALLBACK,
    });
    setSending(false);
    if (error) {
      setInvalid(true);
      return;
    }
    setSentTo(address);
  }

  function close() {
    setSentTo(null);
    setInvalid(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {/* The scrim and the panel shadow are the artboard's own literals and have
          no token in `cc-theme.css`; `AuthReasonDialog` already ships this exact
          scrim, so the two dialogs match rather than each inventing a value. */}
      <DialogContent
        showCloseButton={false}
        overlayClassName={cn(
          "supports-backdrop-filter:backdrop-blur-none",
          revealing ? "bg-[rgba(14,26,44,0.08)]" : "bg-[rgba(14,26,44,0.34)]",
        )}
        className={cn(
          "cc-theme w-[396px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] border border-cc-rule2 bg-cc-surface p-6 text-cc-ink shadow-[0_20px_56px_rgba(14,26,44,0.26)] sm:max-w-[396px]",
          revealing && "top-auto bottom-9 translate-y-0",
        )}
      >
        {status === "sign-in" && sentTo === null ? (
          <SignIn
            email={email}
            invalid={invalid}
            sending={sending}
            onEmail={(value) => {
              setEmail(value);
              setInvalid(false);
            }}
            onSubmit={sendLink}
            onClose={close}
          />
        ) : null}

        {status === "sign-in" && sentTo !== null ? (
          <Panel
            title="Check your inbox"
            onClose={close}
            body={`A private link is on its way to ${sentTo}. It expires in five minutes, and it only works once.`}
          />
        ) : null}

        {status === "expired" ? (
          <Panel
            title="This link no longer works"
            alert
            onClose={close}
            body="Private links expire after a short while, and each one can be used once. Request a new link to try again."
          >
            <FilledButton
              onClick={() => {
                setSentTo(null);
                onRetry();
              }}
            >
              Request a new link
            </FilledButton>
          </Panel>
        ) : null}

        {status === "locating" ? (
          <div>
            <DialogTitle className="font-semibold text-[19px] leading-[1.2] tracking-[-0.012em]">
              Find your place in the community
            </DialogTitle>
            <DialogDescription
              aria-live="polite"
              className="mt-2 text-[13.5px] text-cc-muted leading-[1.55]"
            >
              Locating your dot in the network…
            </DialogDescription>
            <div className="mt-4 h-[3px] overflow-hidden rounded-[2px] bg-cc-pill">
              <div className="h-full w-3/5 rounded-[2px] bg-cc-brand opacity-80" />
            </div>
          </div>
        ) : null}

        {status === "placed" ? (
          <Panel
            title="This one is yours"
            onClose={close}
            body="Your dot is marked in the network behind this panel. It stays yours — you keep the same place every time you come back."
          >
            <OutlineButton onClick={close}>Done</OutlineButton>
          </Panel>
        ) : null}

        {status === "unplaced" ? <Unplaced onClose={close} /> : null}

        {status === "unavailable" ? (
          <Panel
            title="The network did not answer"
            alert
            onClose={close}
            body="Your place is safe — this read failed, not your dot. Try again in a moment."
          >
            <FilledButton onClick={onRetry}>Try again</FilledButton>
          </Panel>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SignIn(props: {
  email: string;
  invalid: boolean;
  sending: boolean;
  onEmail: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <form
      // The panel validates and reports in its own words; the browser's bubble
      // would interrupt with a second, different message.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!props.sending) props.onSubmit();
      }}
    >
      <Header
        title="Find your place in the community"
        onClose={props.onClose}
      />
      <DialogDescription className="mt-2 text-[13.5px] text-cc-muted leading-[1.55]">
        Your dot belongs to your account. Enter your email and we’ll send a
        private link that signs you in and takes you straight to it.
      </DialogDescription>
      <input
        type="email"
        value={props.email}
        onChange={(event) => props.onEmail(event.target.value)}
        placeholder="you@kth.se"
        aria-label="Email address"
        aria-invalid={props.invalid}
        aria-describedby={props.invalid ? "find-your-dot-error" : undefined}
        className={cn(
          "mt-4 h-10 w-full rounded-[9px] border bg-cc-inset px-3 text-[13.5px] text-cc-ink outline-none",
          props.invalid ? "border-cc-warn-ink" : "border-cc-rule3",
        )}
      />
      {props.invalid ? (
        <p
          id="find-your-dot-error"
          role="alert"
          className="mt-2 text-[12.5px] text-cc-warn-ink"
        >
          Enter a valid email address.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={props.sending}
        className="mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-cc-btn font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[0.88] disabled:opacity-70"
      >
        {props.sending ? <Spinner /> : null}
        {props.sending ? "Sending…" : "Send private link"}
      </button>
    </form>
  );
}

/**
 * Signed in, and no node exists for this app user.
 *
 * This is the state every member sees today: `graph.join` places a node and
 * nothing calls it yet. The panel says so plainly rather than drawing a dot
 * that is not there — an invented position would be a lie about where somebody
 * stands in the community, and it would be the first thing to go wrong when
 * placement does land.
 */
function Unplaced({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <Header title="You don’t have a dot yet" onClose={onClose} />
      <div
        aria-hidden
        className="mt-4 flex h-[92px] items-center justify-center rounded-[10px] border border-cc-rule2 border-dashed bg-cc-inset"
      >
        <span className="size-[15px] rounded-full border border-cc-rule3 border-dashed" />
      </div>
      <DialogDescription
        aria-live="polite"
        className="mt-3.5 text-[13.5px] text-cc-muted leading-[1.55]"
      >
        Everyone in the community keeps one place that stays theirs. Yours has
        not been created yet — nothing is missing on your side, and nothing here
        is hidden from you.
      </DialogDescription>
      <p className="mt-2 text-[12.5px] text-cc-dim2 leading-[1.5]">
        Come back once placement is switched on and this is where your dot
        appears.
      </p>
      <OutlineButton onClick={onClose}>Done</OutlineButton>
    </div>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <DialogTitle className="font-semibold text-[19px] leading-[1.2] tracking-[-0.012em]">
        {title}
      </DialogTitle>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] text-[17px] text-cc-dim leading-none hover:bg-cc-pill"
      >
        ×
      </button>
    </div>
  );
}

function Panel(props: {
  title: string;
  body: string;
  alert?: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <Header title={props.title} onClose={props.onClose} />
      <DialogDescription
        role={props.alert ? "alert" : undefined}
        aria-live={props.alert ? undefined : "polite"}
        className="mt-2 text-[13.5px] text-cc-muted leading-[1.55]"
      >
        {props.body}
      </DialogDescription>
      {props.children}
    </div>
  );
}

function FilledButton(props: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="mt-4 flex h-[38px] w-full items-center justify-center rounded-[9px] bg-cc-btn font-semibold text-[13px] text-cc-btn-fg hover:opacity-[0.88]"
    >
      {props.children}
    </button>
  );
}

function OutlineButton(props: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="mt-4 flex h-[38px] w-full items-center justify-center rounded-[9px] border border-cc-rule3 bg-cc-surface font-medium text-[13px] text-cc-ink hover:border-cc-hov"
    >
      {props.children}
    </button>
  );
}
