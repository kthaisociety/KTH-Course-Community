"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import Session from "supertokens-auth-react/recipe/session";
import { useUser } from "@/hooks/userHooks";
import { getCourseNames } from "@/lib/courses";
import type { Dispatch } from "@/state/store";
import { setProfilePicture } from "@/state/user/userSlice";
import {
  deleteAccount,
  deleteTranscriptCourse,
  getUser,
  uploadProfilePicture,
  uploadTranscript,
} from "@/state/user/userThunk";
import ProfileView from "@/views/ProfileView";

export default function ProfileController() {
  const router = useRouter();
  const {
    name,
    email,
    profilePicture,
    userReviews,
    userLikedReviews,
    transcriptCourses,
  } = useUser();
  const dispatch = useDispatch<Dispatch>();
  const [courseNames, setCourseNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const codes = [
      ...new Set([
        ...transcriptCourses.map((c) => c.courseCode),
        ...userReviews.map((r) => r.courseCode),
        ...userLikedReviews.map((r) => r.review.courseCode),
      ]),
    ];
    if (codes.length === 0) return;
    getCourseNames(codes)
      .then(setCourseNames)
      .catch(() => {});
  }, [transcriptCourses, userReviews, userLikedReviews]);

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

  const handleTranscriptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await dispatch(uploadTranscript(file));
    if (!result.success) {
      toast.error(result.error || "Transcript upload failed.");
      return;
    }
    const { imported, unrecognized } = result;
    if (imported.length > 0) {
      toast.success(
        `Imported ${imported.length} course${imported.length !== 1 ? "s" : ""}.`,
      );
    }
    if (unrecognized.length > 0) {
      toast.warning(
        `${unrecognized.length} course code${unrecognized.length !== 1 ? "s" : ""} not found in the database.`,
      );
    }
    if (imported.length === 0 && unrecognized.length === 0) {
      toast.info("No courses found in the uploaded transcript.");
    }
  };

  const handleDeleteCourse = async (courseCode: string) => {
    const result = await dispatch(deleteTranscriptCourse(courseCode));
    if (!result.success) {
      toast.error(result.error || "Failed to remove the course.");
    }
  };

  const onClickReview = useCallback(
    (courseCode: string) => {
      router.push(`/course/${courseCode}`);
    },
    [router],
  );

  return (
    <ProfileView
      name={name}
      email={email}
      preview={profilePicture}
      userReviews={userReviews}
      userLikedReviews={userLikedReviews}
      transcriptCourses={transcriptCourses}
      courseNames={courseNames}
      handleFileChange={handleFileChange}
      handleTranscriptUpload={handleTranscriptUpload}
      handleDeleteAccount={handleDeleteAccount}
      handleDeleteCourse={handleDeleteCourse}
      onClickReview={onClickReview}
    />
  );
}
