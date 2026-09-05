import { put } from "@vercel/blob";
import { getAuth } from "@/server/auth";
import { capRequestBody, isRequestBodyTooLarge } from "@/server/http/body-cap";
import { updateImage } from "@/server/user/service";

export const runtime = "nodejs";

const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * What the whole multipart body may weigh, as opposed to the picture inside it.
 *
 * The cap counts bytes off the wire, and those bytes carry the boundary, the
 * part headers and the filename as well as the image. The allowance is what
 * keeps a picture of exactly `MAX_BYTES` acceptable — without it the envelope
 * would push a legal upload over the cap and the route would reject a file it
 * has always accepted. It is deliberately small: the framing is a few hundred
 * bytes in practice, and the point of the number is that it is bounded.
 */
const MAX_BODY_BYTES = MAX_BYTES + 16 * 1024;

const TOO_LARGE = "Image must be less than 2MB";

export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session?.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Counted as the body arrives, exactly as the transcript upload counts its
  // own. `formData()` buffers the whole body before anything can look at the
  // file's size, so checking `file.size` afterwards is a check made after the
  // damage: any signed-in caller could hand the server an arbitrarily large
  // upload and have it held in memory first and rejected second. Content-Length
  // is no substitute — it is absent on a chunked upload and a lie whenever the
  // client wants it to be.
  let formData: FormData;
  try {
    formData = await capRequestBody(request, MAX_BODY_BYTES).formData();
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return Response.json({ message: TOO_LARGE }, { status: 413 });
    }
    return Response.json(
      { message: "No file provided or invalid image type" },
      { status: 400 },
    );
  }

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
  // The stream cap bounds the envelope; this bounds the picture. Both are
  // needed: the cap is what stops the memory being spent, and this is what
  // holds the stated 2MB limit to the byte once the parts are separated.
  if (file.size > MAX_BYTES) {
    return Response.json({ message: TOO_LARGE }, { status: 400 });
  }

  const blob = await put(file.name, file, {
    access: "public",
    addRandomSuffix: true,
  });
  await updateImage(session.user.id, blob.url);
  return Response.json({ url: blob.url });
}
