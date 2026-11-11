// GET /api/photo?id=<public id>  ->  the image bytes, but ONLY for an admin or the rider who owns it.
import { authenticate, route, fetchPhoto, PHOTO_ID, HttpError } from "./_lib.js";

export default route("GET", async (req, res) => {
  const me = await authenticate(req);
  const id = String(req.query?.id || "");
  const m = PHOTO_ID.exec(id);
  if (!m) throw new HttpError(400, "Bad photo id.");
  if (!me.isAdmin && m[1] !== me.uid) throw new HttpError(403, "You can't open this photo.");
  const buf = await fetchPhoto(id);
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).send(buf);
});
