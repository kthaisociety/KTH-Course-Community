import { nestHttpUrl } from "@/lib/nest-http";
import type { Dispatch } from "@/state/store";
import { clearUser, setImage, setUser } from "./userSlice";

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
          image: data.image ?? null,
          userFavorites: data.userFavorites ?? [],
        }),
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
export function uploadImage(file: File) {
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
      dispatch(setImage(data.url));
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
