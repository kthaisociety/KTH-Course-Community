import { put } from "@vercel/blob";
import { getAuth } from "@/server/auth";
import { updateImage } from "@/server/services/user";

export const runtime = "nodejs";

const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { message: "No file provided or invalid image type" },
      { status: 400 },
    );
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json(
      { message: "No file provided or invalid image type" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { message: "Image must be less than 2MB" },
      { status: 400 },
    );
  }

  const blob = await put(file.name, file, {
    access: "public",
    addRandomSuffix: true,
  });
  await updateImage(session.user.id, blob.url);
  return Response.json({ url: blob.url });
}
