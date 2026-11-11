import { useEffect, useState } from "react";
import { doc, onSnapshot, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import PhotoBox from "./PhotoBox";
import { niceError } from "../utils/errors";
import { api } from "../utils/api";
import { ID_TYPES, storeNumber } from "../utils/idTypes";

const META = {
  identity: { title: "Identity verification", step: 1, field: "kycIdentity" },
  license: { title: "Driving licence verification", step: 2, field: "kycLicense" },
};
export const STATUS_TEXT = { none: "Not submitted", na: "Not required", submitted: "Under review", verified: "Verified", rejected: "Rejected" };

export default function KycCard({ type, riderId }) {
  const m = META[type];
  const [saved, setSaved] = useState(undefined); // undefined = loading, null = none
  const [idType, setIdType] = useState("aadhaar");
  const [num, setNum] = useState("");
  const [expiry, setExpiry] = useState("");
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(
    () => onSnapshot(doc(db, "riders", riderId, "kyc", type), (s) => setSaved(s.exists() ? s.data() : null), () => setSaved(null)),
    [riderId, type]
  );

  const kind = type === "license" ? "license" : idType;
  const spec = ID_TYPES[kind];
  const status = saved?.status || "none";
  const canEdit = status === "none" || status === "rejected";

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!spec.ok(num)) return setErr(`This ${spec.label} number does not look right (${spec.hint}). Please check it.`);
    if (type === "license" && (!expiry || new Date(expiry) < new Date(new Date().toDateString())))
      return setErr("This licence has expired. Enter a valid expiry date.");
    if (!front) return setErr("Upload the front photo.");
    if (spec.back && !back) return setErr("Upload the back photo too.");

    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "riders", riderId, "kyc", type), {
        idType: kind,
        number: storeNumber(kind, num),
        front,
        back: back || "",
        expiry: type === "license" ? expiry : "",
        status: "submitted",
        note: "",
        submittedAt: serverTimestamp(),
      });
      batch.update(doc(db, "riders", riderId), { [m.field]: "submitted" });
      await batch.commit();
      // tell the server to forward the photos to the admin's WhatsApp (admin can also resend from the panel)
      api("/api/notify", { method: "POST", body: { kind: type } }).catch(() => {});
      setNum(""); setFront(null); setBack(null);
    } catch (x) {
      setErr(niceError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card kyc">
      <div className="row between">
        <div className="row">
          <span className={`step-dot ${status}`}>{status === "verified" ? "✓" : m.step}</span>
          <h2>{m.title}</h2>
        </div>
        <span className={`pill ${status}`}>{STATUS_TEXT[status]}</span>
      </div>

      {saved === undefined && <p className="muted">Loading…</p>}

      {type === "identity" && canEdit && <p className="muted">Verify with any ONE government ID you have: Aadhaar, Voter ID, PAN, Passport or Driving Licence.</p>}
      {status === "rejected" && <p className="error">Rejected{saved?.note ? `: ${saved.note}` : "."} Please upload again.</p>}
      {status === "submitted" && <p className="muted">Sent for review. This page updates by itself when an admin checks it.</p>}
      {status === "verified" && (
        <p className="muted">{ID_TYPES[saved?.idType]?.label || "Document"} {saved?.number} is verified.{saved?.expiry ? ` Valid till ${saved.expiry}.` : ""}</p>
      )}

      {saved !== undefined && canEdit && (
        <form className="stack" onSubmit={submit}>
          {type === "identity" && (
            <label>ID type
              <select value={idType} onChange={(e) => { setIdType(e.target.value); setNum(""); setBack(null); }}>
                {Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
          )}
          <label>{spec.label} number
            <input value={num} onChange={(e) => setNum(spec.clean(e.target.value))} inputMode={kind === "aadhaar" ? "numeric" : "text"} placeholder={spec.hint} required />
          </label>
          {type === "license" && (
            <label>Valid till<input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} required /></label>
          )}
          <div className="row id-row">
            <PhotoBox kind="doc" slot="front" value={front} label="Front photo" onChange={setFront} onError={setErr} />
            {spec.back && <PhotoBox kind="doc" slot="back" value={back} label="Back photo" onChange={setBack} onError={setErr} />}
          </div>
          <p className="muted">Use good light. All four corners and every word must be readable.</p>
          {err && <p className="error">{err}</p>}
          <button className="btn" disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</button>
        </form>
      )}
    </section>
  );
}
