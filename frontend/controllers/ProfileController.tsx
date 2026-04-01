"use client";

import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import Session from "supertokens-auth-react/recipe/session";
import type { AppDispatch, RootState } from "@/state/store";
import { setProfilePicture } from "@/state/user/userSlice";
import {
  deleteAccount,
  getUser,
  uploadProfilePicture,
} from "@/state/user/userThunk";
import ProfileView from "@/views/ProfileView";

export default function ProfileController() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { name, email, profilePicture } = useSelector(
    (state: RootState) => state.user,
  );

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const localPreview = URL.createObjectURL(file);
      dispatch(setProfilePicture(localPreview));

      // Await the resolved return value of the thunk, which is always {success, error?}
      const result: {
        success: boolean;
        url?: string;
        error?: string;
        message?: string;
      } = await dispatch(uploadProfilePicture(file));
      if (!result.success) {
        toast.error(result.error || result.message || "Image upload failed.");
        if (profilePicture) dispatch(setProfilePicture(profilePicture));
        URL.revokeObjectURL(localPreview);
        return;
      }
      await dispatch(getUser());
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
      await Session.signOut();
      router.push("/");
    }
  };

  return (
    <ProfileView
      name={name}
      email={email}
      preview={profilePicture}
      handleFileChange={handleFileChange}
      handleDeleteAccount={handleDeleteAccount}
    />
  );
}
