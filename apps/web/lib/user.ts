"use client";

export type Me = {
  userId: string;
  name: string;
  email: string;
  savedCourseCodes: string[];
  image: string | null;
};

export async function uploadProfilePicture(
  file: File,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/user/profile-picture", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const error = await res.json();
        errorMsg = error?.message || error?.error || errorMsg;
      } catch {
        errorMsg = await res.text();
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    return { success: true, url: data.url };
  } catch (err) {
    if (err instanceof Error) {
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
}
