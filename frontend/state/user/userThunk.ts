import { nestHttpUrl } from "@/lib/nest-http";
import { getUserFavorites } from "@/lib/user";
import type { Dispatch, RootState } from "@/state/store";
import { clearUser, favoritesLoaded, favoritesLoading } from "./userSlice";

/**
 * Loads the user's favorite course codes once per session.
 * Guarded on `status` because several components call `useFavorites()` in the
 * same render pass and would otherwise each fire their own request.
 */
export function fetchFavorites() {
  return async (dispatch: Dispatch, getState: () => RootState) => {
    if (getState().user.status !== "idle") return;
    dispatch(favoritesLoading());
    try {
      dispatch(favoritesLoaded(await getUserFavorites()));
    } catch (err) {
      console.error("Failed to fetch favorites:", err);
      // Settle as an empty list rather than staying in "loading" forever, so
      // the UI stops spinning and the effect does not retry in a loop.
      dispatch(favoritesLoaded([]));
    }
  };
}

// Uploading profile picture
export function uploadImage(file: File) {
  return async () => {
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
