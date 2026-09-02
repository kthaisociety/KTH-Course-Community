"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useLogout, useRequireSession, useUserQueries } from "@/features/auth";
import { type Me, uploadProfilePicture } from "@/lib/user";
import { useProfileMutations } from "../api/mutations";
import { ProfileView } from "./profile-view";

export function ProfileScreen() {
  const userQueries = useUserQueries();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { user, refetch } = useRequireSession();
  const [preview, setPreview] = useState<string | null>(null);
  const profile = useProfileMutations();
  const deleteAccount = useMutation(profile.remove());
  const meKey = userQueries.me().queryKey;

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

    queryClient.setQueryData<Me | null>(meKey, (current) =>
      current ? { ...current, image: result.url } : current,
    );
    await queryClient.invalidateQueries({ queryKey: meKey });
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
        await deleteAccount.mutateAsync();
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
