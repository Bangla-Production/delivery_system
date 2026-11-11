// POST { kind: "identity" | "license" }            rider: send my just-submitted documents to the admin's WhatsApp
// POST { kind: "identity"|"license", riderId }     admin: send a rider's documents again
// POST { kind: "test" }                            admin: send a test message to the saved number
// The destination number is read from Firestore (settings/notify) on EVERY call, so changing it in the
// admin panel takes effect immediately. Everything sent is read server-side; the client only names a document.
import { authenticate, route, services, fetchPhoto, HttpError } from "./_lib.js";
import { uploadMedia, sendImage, sendText, explain } from "./_whatsapp.js";

const ID_LABEL = { aadhaar: "Aadhaar", voter: "Voter ID", pan: "PAN", passport: "Passport", license: "Driving Licence" };

export default route("POST", async (req, res) => {
  const me = await authenticate(req);
  const kind = req.body?.kind;
  if (!["identity", "license", "test"].includes(kind)) throw new HttpError(400, "Bad request.");
  if (kind === "test" && !me.isAdmin) throw new HttpError(403, "Admins only.");
  if (!me.isAdmin && !me.emailVerified) throw new HttpError(403, "Verify your email first.");

  const { db } = services();
  const to = (await db.doc("settings/notify").get()).data()?.whatsappNumber;
  const rid = me.isAdmin && req.body?.riderId ? String(req.body.riderId) : me.uid;
  const kycRef = db.doc(`riders/${rid}/kyc/${kind}`);

  const record = async (patch) => { if (kind !== "test") await kycRef.set(patch, { merge: true }); };
  if (!to) {
    await record({ waStatus: "no-number" });
    throw new HttpError(409, "No WhatsApp number is saved yet. Set it in Admin panel → WhatsApp.");
  }

  try {
    if (kind === "test") {
      await sendText(to, "✅ Abar Khabo: test message. Rider documents will be sent to this WhatsApp number.");
      return res.status(200).json({ ok: true });
    }

    const [riderSnap, kycSnap] = await Promise.all([db.doc(`riders/${rid}`).get(), kycRef.get()]);
    if (!riderSnap.exists || !kycSnap.exists) throw new HttpError(404, "Nothing to send.");
    const r = riderSnap.data();
    const k = kycSnap.data();
    if (!me.isAdmin) {
      if (k.status !== "submitted") throw new HttpError(409, "Nothing new to send.");
      if (k.waSentFor && k.waSentFor === k.submittedAt?.toMillis?.()) return res.status(200).json({ ok: true, skipped: true });
    }

    const idLabel = ID_LABEL[k.idType] || k.idType;
    const head = `${r.name} · ${r.phone}\n${kind === "license" ? "Driving licence" : "Identity"}: ${idLabel} ${k.number}${k.expiry ? ` (valid till ${k.expiry})` : ""}\n${r.vehicle}${r.vehicleNumber ? " " + r.vehicleNumber : ""} · ${r.email}`;
    const items = [
      [r.photo, `${head}\n\nSelfie (match it with the ID)`],
      [k.front, `${r.name}: ${idLabel} FRONT`],
      [k.back, `${r.name}: ${idLabel} BACK`],
    ].filter(([p]) => p);

    // download + hand to WhatsApp in parallel, then send in order
    const media = await Promise.all(items.map(async ([p]) => uploadMedia(await fetchPhoto(p))));
    for (let i = 0; i < items.length; i++) await sendImage(to, media[i], items[i][1]);

    await kycRef.set({ waStatus: "sent", waSentFor: k.submittedAt?.toMillis?.() || 0, waAt: new Date(), waError: "" }, { merge: true });
    res.status(200).json({ ok: true });
  } catch (e) {
    const msg = explain(e);
    await record({ waStatus: "failed", waError: msg.slice(0, 300) }).catch(() => {});
    throw new HttpError(e instanceof HttpError ? e.status : 502, msg);
  }
});
