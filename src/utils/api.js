import { auth } from "../firebase";

// fetch() to our own /api functions with the logged-in user's Firebase token attached.
export async function api(path, { method = "GET", body } = {}) {
  const u = auth.currentUser;
  if (!u) throw new Error("Please log in again.");
  const token = await u.getIdToken();
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Request failed (${res.status})`);
  }
  return res;
}
