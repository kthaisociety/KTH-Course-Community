"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    try {
      await deleteAccount.mutateAsync();
    } catch (err) {
      console.error("Deletion failed:", err);
    }
    await logout();
  };

  const getInitials = (value: string) =>
    value
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-6 text-4xl font-bold text-foreground">My Profile</h1>
      <p className="mb-10 text-muted-foreground">
        Manage your account settings and preferences
      </p>

      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your profile picture and personal details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="flex items-center gap-6">
                <Avatar className="size-24">
                  {image ? <AvatarImage src={image} alt={name} /> : null}
                  <AvatarFallback>{getInitials(name || email)}</AvatarFallback>
                </Avatar>

                <Field>
                  <FieldLabel htmlFor="profile-upload">
                    Profile Picture
                  </FieldLabel>
                  <Button variant="secondary" size="sm" asChild>
                    <label htmlFor="profile-upload">Upload New</label>
                  </Button>
                  <Input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                  <FieldDescription>
                    Max 2MB. JPG, PNG, or GIF.
                  </FieldDescription>
                </Field>
              </div>

              <Field data-disabled>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input id="name" value={name} disabled className="max-w-md" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delete Account</CardTitle>
            <CardDescription>
              Permanently remove your account and data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTitle>This can't be undone</AlertTitle>
              <AlertDescription>
                Once deleted, your account and data can't be recovered.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete your account? This can't be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDeleteAccount}
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
