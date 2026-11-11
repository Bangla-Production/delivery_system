// Minimal WhatsApp Business Cloud API client (Meta). Needs WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID.
// Free-form images/text only reach the admin inside WhatsApp's 24-hour window (the admin must have messaged
// the business number in the last 24h). Outside it, we fall back to an approved TEMPLATE with an image header
// (WHATSAPP_TEMPLATE_NAME) so photos still arrive. See README.
import { HttpError } from "./_lib.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const needCfg = () => {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID)
    throw new HttpError(500, "WhatsApp is not set up on the server yet (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).");
};

class WaError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function call(path, init) {
  const r = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, ...(init.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new WaError(j?.error?.code, j?.error?.message || `WhatsApp error ${r.status}`);
  return j;
}

const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", ...body }) });

export async function uploadMedia(buf) {
  needCfg();
  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("type", "image/jpeg");
  fd.append("file", new Blob([buf], { type: "image/jpeg" }), "photo.jpg");
  return (await call("media", { method: "POST", body: fd })).id;
}

// Template params may not contain newlines/tabs.
const oneLine = (s) => String(s).replace(/\s*\n+\s*/g, " | ").replace(/\s{2,}/g, " ").slice(0, 900);

export async function sendImage(to, mediaId, caption) {
  needCfg();
  try {
    await call("messages", json({ to, type: "image", image: { id: mediaId, caption: String(caption).slice(0, 1000) } }));
  } catch (e) {
    const tpl = process.env.WHATSAPP_TEMPLATE_NAME;
    if (e.code === 131047 && tpl) {
      await call("messages", json({
        to, type: "template",
        template: {
          name: tpl,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [
            { type: "header", parameters: [{ type: "image", image: { id: mediaId } }] },
            { type: "body", parameters: [{ type: "text", text: oneLine(caption) }] },
          ],
        },
      }));
      return;
    }
    throw e;
  }
}

export async function sendText(to, body) {
  needCfg();
  await call("messages", json({ to, type: "text", text: { body: String(body).slice(0, 3000) } }));
}

export function explain(e) {
  if (e instanceof WaError && e.code === 131047)
    return "WhatsApp only lets the business send free messages within 24 hours of your last message to it. Send \"hi\" from the admin WhatsApp to the business number, or set up the image template (see README).";
  return e.message || "WhatsApp send failed.";
}
