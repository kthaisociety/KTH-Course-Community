"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type Me, uploadProfilePicture } from "@/lib/user";
import { useTRPC } from "@/trpc/client";

type Props = {
  user: Me | null;
  /** The earliest year the viewer recorded attending anything, if they have one. */
  sinceYear: number | null;
};

/**
 * Who the reader is, and the one control that changes it.
 *
 * The artboard's line reads "At KTH since 2023 · reviews signed Elsa
 * Lindqvist". The second half is dropped: `reviews` carries a user id and
 * nothing else about its author, and no surface in this app renders a
 * reviewer's name — `cc-store.js`'s `signedName` is a sketch the Review Card
 * artboard itself contradicts. The first half is the earliest
 * `attendance_year` on the viewer's taken courses, and it is left out entirely
 * when they have none rather than shown as an em dash beside a date nobody
 * recorded.
 *
 * The picture posts multipart to `/api/user/profile-picture`, which is why it
 * is not a tRPC procedure. That route already exists and is the only one.
 */
export function Identity({ user, sinceYear }: Props) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);

  const name = user?.name ?? "";
  const email = user?.email ?? "";
  const image = preview ?? user?.image ?? null;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file twice fires a change event again.
    event.target.value = "";
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);

    const result = await uploadProfilePicture(file);
    setUploading(false);

    if (result.success) {
      // The preview is held until the refreshed `user.me` is in the cache.
      // Dropping it first would show the old picture for as long as the refetch
      // takes, and revoking the object URL while it is still on screen would
      // blank the avatar outright.
      await queryClient.invalidateQueries({
        queryKey: trpc.user.me.queryKey(),
      });
    } else {
      toast.error(result.error || "Image upload failed.");
    }

    setPreview(null);
    URL.revokeObjectURL(localPreview);
  }

  return (
    <div className="flex items-center gap-3.5 px-7 pt-[18px] @max-[440px]:px-[14px]">
      <Avatar className="size-[52px] flex-none">
        {image ? <AvatarImage src={image} alt="" /> : null}
        <AvatarFallback className="bg-cc-pill font-semibold text-[16px] text-cc-brand">
          {initialsOf(name || email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-semibold text-[19px] leading-[1.25]">
          {name || email}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-cc-muted">
          {sinceYear === null ? null : (
            <>
              <span>At KTH since {sinceYear}</span>
              <span aria-hidden>·</span>
            </>
          )}
          {/*
            A label rather than a button driving a hidden input: one control for
            one job, so a screen reader is not offered both.
          */}
          <label
            htmlFor={inputId}
            className="cursor-pointer font-medium text-cc-brand hover:underline"
          >
            {isUploading ? "Uploading…" : "Change photo"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            disabled={isUploading}
            className="sr-only"
            onChange={(event) => void handleFile(event)}
          />
        </div>
      </div>
    </div>
  );
}

/** Up to two initials for the avatar, falling back to a question mark. */
function initialsOf(value: string): string {
  const letters = value
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
  return letters.slice(0, 2) || "?";
}
