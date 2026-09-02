"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useRequireSession } from "@/hooks/sessionHooks";
import { useLogout } from "@/hooks/useLogout";
import { queryKeys } from "@/lib/query-keys";
import { deleteAccount, type Me, uploadProfilePicture } from "@/lib/user";
import ProfileView from "@/views/ProfileView";

export default function ProfileController() {
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { user, refetch } = useRequireSession();
  const [preview, setPreview] = useState<string | null>(null);

  const name = user?.name ?? "";
  const email = user?.email ?? "";
  const image = preview ?? user?.image ?? null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const result = await uploadProfilePicture(file);
    if (!result.success) {
      toast.error(result.error || "Image upload failed.");
      setPreview(null);
      URL.revokeObjectURL(localPreview);
      return;
    }

    queryClient.setQueryData<Me | null>(queryKeys.me, (current) =>
      current ? { ...current, image: result.url } : current,
    );
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    await refetch();
    setPreview(null);
    URL.revokeObjectURL(localPreview);
  };

  const handleDeleteAccount = async () => {
    if (
      confirm(
        "Are you sure you want to delete your account? This can't be undone.",
      )
    ) {
      try {
        await deleteAccount();
      } catch (err) {
        console.error("Deletion failed:", err);
      }
      await logout();
    }
  };

  return (
    <ProfileView
      name={name}
      email={email}
      preview={image}
      handleFileChange={handleFileChange}
      handleDeleteAccount={handleDeleteAccount}
    />
  );
}
