import { compressToBlob } from "./compressImage";
import { api } from "./api";

// Photos are PRIVATE: the server signs each upload (nothing secret in the browser), Cloudinary stores it as an
// "authenticated" asset with no public link, and Firestore keeps only its id. Only the owner and admins can open it
// (through /api/photo, see SecureImg).

// kind: "selfie" | "front" | "back". Takes a ready (already compressed) Blob. Returns the photo id.
export async function uploadBlob(blob, kind) {
  const sig = await (await api("/api/sign-upload", { method: "POST", body: { kind } })).json();
  const fd = new FormData();
  fd.append("file", blob, "photo.jpg");
  for (const k of ["allowed_formats", "public_id", "timestamp", "type", "signature"]) fd.append(k, sig[k]);
  fd.append("api_key", sig.apiKey);
  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: "POST", body: fd });
  } catch {
    throw new Error("Upload failed. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.public_id) throw new Error(data?.error?.message || "Upload failed. Please try again.");
  return data.public_id;
}

export async function uploadImage(file, kind, { max = 1600, quality = 0.82 } = {}) {
  return uploadBlob(await compressToBlob(file, max, quality), kind);
}
