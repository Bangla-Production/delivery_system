// POST { kind: "selfie" | "front" | "back" }  ->  signed parameters for ONE private upload to Cloudinary.
// The browser never sees the API secret, and every upload lands in the caller's own folder as an
// "authenticated" asset (it has no public link; it can only be opened through /api/photo).
import crypto from "node:crypto";
import { authenticate, route, services, HttpError } from "./_lib.js";

export default route("POST", async (req, res) => {
  const me = await authenticate(req);
  const kind = req.body?.kind;
  if (!["selfie", "front", "back"].includes(kind)) throw new HttpError(400, "Bad request.");
  const { cloudinary } = services();

  const params = {
    allowed_formats: "jpg",
    public_id: `abar-khabo/${me.uid}/${kind}-${crypto.randomBytes(8).toString("hex")}`,
    timestamp: Math.floor(Date.now() / 1000),
    type: "authenticated",
  };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
  res.status(200).json({ ...params, signature, apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME });
});
