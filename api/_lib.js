// Shared helpers for the serverless functions in /api (files starting with "_" are not exposed as routes).
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function init() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new HttpError(500, "Server is not set up yet: FIREBASE_SERVICE_ACCOUNT is missing.");
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    initializeApp({ credential: cert(JSON.parse(json)) });
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function services() {
  init();
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
    throw new HttpError(500, "Server is not set up yet: Cloudinary keys are missing.");
  return { db: getFirestore(), auth: getAuth(), cloudinary };
}

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>".
// Returns { uid, email, emailVerified, isAdmin }.
export async function authenticate(req) {
  const { db, auth } = services();
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) throw new HttpError(401, "Please log in again.");
  let t;
  try { t = await auth.verifyIdToken(m[1]); } catch { throw new HttpError(401, "Your login has expired. Please log in again."); }
  const isAdmin = (await db.doc(`admins/${t.uid}`).get()).exists;
  return { uid: t.uid, email: t.email || "", emailVerified: !!t.email_verified, isAdmin };
}

// Wraps a handler: method check + uniform JSON errors. Never leaks stack traces.
export function route(method, fn) {
  return async (req, res) => {
    try {
      if (req.method !== method) { res.setHeader("Allow", method); throw new HttpError(405, "Method not allowed."); }
      await fn(req, res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res.status(status).json({ error: status === 500 && !(e instanceof HttpError) ? "Something went wrong on the server." : e.message });
    }
  };
}

// Photo ids look like  abar-khabo/<uid>/<kind>-<random>  (the uid inside is how ownership is checked)
export const PHOTO_ID = /^abar-khabo\/([A-Za-z0-9]{6,128})\/[a-z]+-[a-f0-9]{16}$/;

// Downloads a private photo (legacy full https URLs are also accepted). Returns a Buffer.
export async function fetchPhoto(idOrUrl) {
  const { cloudinary } = services();
  const url = /^https:\/\//.test(idOrUrl)
    ? idOrUrl
    : cloudinary.utils.private_download_url(idOrUrl, "jpg", {
        resource_type: "image",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 300,
      });
  const r = await fetch(url);
  if (!r.ok) throw new HttpError(404, "Photo not found.");
  return Buffer.from(await r.arrayBuffer());
}
