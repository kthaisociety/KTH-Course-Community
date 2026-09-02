"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogout, useRequireSession } from "@/features/auth";
import { type Me, uploadProfilePicture } from "@/lib/user";
import { useTRPC } from "@/trpc/client";
import { useDeleteAccount } from "../api/mutations";

export function Profile() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { user, refetch } = useRequireSession();
  const [preview, setPreview] = useState<string | null>(null);
  const deleteAccount = useDeleteAccount();
  const meKey = trpc.user.me.queryKey();

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

  const getInitials = (value: string) =>
    value
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <main className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold text-foreground mb-6">My Profile</h1>
      <p className="text-muted-foreground mb-10">
        Manage your account settings and preferences
      </p>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your profile picture and personal details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24 border-4 border-primary/10">
                {image ? (
                  <AvatarImage
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getInitials(name || email)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="space-y-2">
                <Label htmlFor="profile-upload">Profile Picture</Label>
                <div className="flex gap-2">
                  <label htmlFor="profile-upload">
                    <Button variant="secondary" size="sm" asChild>
                      <span>Upload New</span>
                    </Button>
                    <Input
                      id="profile-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Max 2MB. JPG, PNG, or GIF.
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                readOnly
                className="max-w-md bg-muted cursor-not-allowed"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Delete Account</CardTitle>
            <CardDescription>
              Permanently remove your account and data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-destructive/5 p-4 border border-destructive/20">
              <p className="text-sm text-muted-foreground mb-4">
                Once deleted, your account and data can't be recovered.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAccount}
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
