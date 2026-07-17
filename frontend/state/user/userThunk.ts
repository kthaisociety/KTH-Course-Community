import { nestHttpUrl } from "@/lib/nest-http";
import type { Dispatch } from "@/state/store";
import {
  clearUser,
  removeTranscriptCourse,
  setProfilePicture,
  setTranscriptCourses,
  setUser,
} from "./userSlice";

export function getUser() {
  return async (dispatch: Dispatch) => {
    try {
      const res = await fetch(nestHttpUrl("/user/me"));

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      dispatch(
        setUser({
          name: data.name,
          email: data.email,
          profilePicture: data.profilePicture ?? null,
          userFavorites: data.userFavorites ?? [],
          userReviews: data.userReviews ?? [],
          userLikedReviews: data.userLikedReviews ?? [],
        }),
      );
      dispatch(
        setTranscriptCourses(
          (data.transcriptCourses ?? []).map(
            (c: {
              courseCode: string;
              grade: string | null;
              credits: number | null;
            }) => ({
              courseCode: c.courseCode,
              grade: c.grade ?? null,
              credits: c.credits ?? null,
            }),
          ),
        ),
      );
      return { success: true as const };
    } catch (err) {
      console.error("Failed to fetch user:", err);
      dispatch(clearUser());
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "Failed to fetch user",
      };
    }
  };
}

// Uploading profile picture
export function uploadProfilePicture(file: File) {
  return async (dispatch: Dispatch) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(nestHttpUrl("/user/profile-picture"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const error = await res.json();
          errorMsg = error?.message || error?.error || errorMsg;
        } catch (_jsonErr) {
          errorMsg = await res.text();
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      dispatch(setProfilePicture(data.url));
      return { success: true, url: data.url };
    } catch (err) {
      if (err instanceof Error) {
        // Some known errors
        if (/file.*type/i.test(err.message)) {
          return { success: false, error: "Please select an image file." };
        }
        if (/file.*size/i.test(err.message)) {
          return { success: false, error: "Image must be less than 2MB." };
        }
        if (/no file/i.test(err.message)) {
          return { success: false, error: "No file provided." };
        }
        return { success: false, error: err.message };
      }
      return { success: false, error: "Unknown upload error" };
    }
  };
}

export function uploadTranscript(file: File) {
  return async (dispatch: Dispatch) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(nestHttpUrl("/user/transcript"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const error = await res.json();
          errorMsg = error?.message || error?.error || errorMsg;
        } catch (_jsonErr) {
          errorMsg = await res.text();
        }
        throw new Error(errorMsg);
      }

      const data: { imported: string[]; unrecognized: string[] } =
        await res.json();
      // Re-fetch full course data (with grades/credits) after upload
      await dispatch(fetchTranscriptCourses());
      return { success: true as const, ...data };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "Upload failed",
      };
    }
  };
}

export function fetchTranscriptCourses() {
  return async (dispatch: Dispatch) => {
    try {
      const res = await fetch(nestHttpUrl("/user/transcript-courses"));
      if (!res.ok) return;
      const data: {
        courseCode: string;
        grade: string | null;
        credits: number | null;
      }[] = await res.json();
      dispatch(
        setTranscriptCourses(
          data.map((c) => ({
            courseCode: c.courseCode,
            grade: c.grade,
            credits: c.credits,
          })),
        ),
      );
    } catch {
      // non-critical, silently ignore
    }
  };
}

export function deleteTranscriptCourse(courseCode: string) {
  return async (dispatch: Dispatch) => {
    try {
      const res = await fetch(
        nestHttpUrl(
          `/user/transcript-courses/${encodeURIComponent(courseCode)}`,
        ),
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dispatch(removeTranscriptCourse(courseCode));
      return { success: true as const };
    } catch (err) {
      return {
        success: false as const,
        error:
          err instanceof Error ? err.message : "Failed to remove the course",
      };
    }
  };
}

// Delete account
export function deleteAccount() {
  return async (dispatch: Dispatch) => {
    try {
      const res = await fetch(nestHttpUrl("/user"), {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dispatch(clearUser());
    } catch (err) {
      console.error("Deletion failed:", err);
    }
  };
}
