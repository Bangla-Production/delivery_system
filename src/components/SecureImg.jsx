import { useEffect, useState } from "react";
import { api } from "../utils/api";

// Shows a private photo. The browser asks /api/photo (which checks "admin or owner"), gets the bytes and shows them.
// Old photos saved as full https links still display as before.
const cache = new Map(); // id -> Promise<objectURL>

function load(id) {
  if (!cache.has(id)) {
    cache.set(id, api(`/api/photo?id=${encodeURIComponent(id)}`).then((r) => r.blob()).then((b) => URL.createObjectURL(b)));
    cache.get(id).catch(() => cache.delete(id));
  }
  return cache.get(id);
}

export default function SecureImg({ id, alt = "", className, openOnClick = false }) {
  const legacy = /^https?:\/\//.test(id || "");
  const [src, setSrc] = useState(legacy ? id : null);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    setBad(false);
    if (!id) return setSrc(null);
    if (legacy) return setSrc(id);
    let live = true;
    setSrc(null);
    load(id).then((u) => live && setSrc(u), () => live && setBad(true));
    return () => { live = false; };
  }, [id]);

  if (!id) return null;
  if (bad) return <span className="muted">Photo could not be loaded.</span>;
  if (!src) return <span className="muted">Loading photo…</span>;
  const img = <img className={className} src={src} alt={alt} />;
  return openOnClick ? <a href={src} target="_blank" rel="noreferrer">{img}</a> : img;
}
