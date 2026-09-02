"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { useRequireSession } from "@/hooks/sessionHooks";
import { authClient } from "@/lib/auth-client";
import type { Dispatch } from "@/state/store";
import { deleteAccount, uploadImage } from "@/state/user/userThunk";
import ProfileView from "@/views/ProfileView";

export default function ProfileController() {
  const router = useRouter();
  const dispatch = useDispatch<Dispatch>();
  // Redirects to /auth if the session resolves to null: the proxy only
  // checks that the cookie exists, so a stale one reaches this page.
  const { user, refetch } = useRequireSession();
  // Local object-URL shown while the upload is in flight. The committed image
  // lives on the Better Auth session, so there is nothing to roll back on
  // failure beyond dropping this preview.
  const [preview, setPreview] = useState<string | null>(null);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      // Await the resolved return value of the thunk, which is always {success, error?}
      const result: {
        success: boolean;
        url?: string;
        error?: string;
        message?: string;
      } = await dispatch(uploadImage(file));
      if (!result.success) {
        toast.error(result.error || result.message || "Image upload failed.");
        setPreview(null);
        URL.revokeObjectURL(localPreview);
        return;
      }
      // The backend writes the new URL to the Better Auth users table, so
      // re-reading the session is what refreshes the avatar everywhere.
      await refetch();
      setPreview(null);
      URL.revokeObjectURL(localPreview);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (
      confirm(
        "Are you sure you want to delete your account? This can't be undone.",
      )
    ) {
      await dispatch(deleteAccount());
      await authClient.signOut();
      router.push("/");
    }
  };

  return (
    <ProfileView
      name={user?.name ?? ""}
      email={user?.email ?? ""}
      preview={preview ?? user?.image ?? null}
      handleFileChange={handleFileChange}
      handleDeleteAccount={handleDeleteAccount}
    />
  );
}
