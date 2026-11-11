import { useState } from "react";
import { uploadImage } from "../utils/cloudinary";
import { compressToBlob } from "../utils/compressImage";
import SecureImg from "./SecureImg";

// Tap-to-upload photo box.
// local=false (default): the photo is uploaded privately right away; `value` is its id.
// local=true (used before the account exists): nothing is uploaded yet; `value` is { blob, preview }.
// kind="round" = selfie, kind="doc" = ID card photo. slot = "selfie" | "front" | "back".
export default function PhotoBox({ value, label, onChange, onError, kind = "doc", slot = "front", local = false, capture }) {
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const opts = kind === "round" ? { max: 800, quality: 0.8 } : { max: 1600, quality: 0.82 };
      if (local) {
        const blob = await compressToBlob(file, opts.max, opts.quality);
        onChange({ blob, preview: URL.createObjectURL(blob) });
      } else {
        onChange(await uploadImage(file, slot, opts));
      }
      onError?.("");
    } catch (x) {
      onError?.(x.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className={`photo-pick ${kind === "doc" ? "doc" : ""} ${value ? "filled" : ""}`}>
      {busy ? (
        <span className="ph"><span className="spin" />Uploading…</span>
      ) : value ? (
        local ? <img src={value.preview} alt={label} /> : <SecureImg id={value} alt={label} />
      ) : (
        <span className="ph">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          {label}
        </span>
      )}
      <input type="file" accept="image/*" capture={capture} onChange={pick} hidden disabled={busy} />
    </label>
  );
}
