import { Fragment, useEffect, useState } from "react";
import {
  collection, onSnapshot, updateDoc, doc, addDoc, deleteDoc, setDoc, runTransaction, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth, db } from "../firebase";
import { fmtPhone, cleanPhone, isIndianPhone } from "../utils/phone";
import SecureImg from "../components/SecureImg.jsx";
import { api } from "../utils/api";
import { STATUS_TEXT } from "../components/KycCard.jsx";
import { VerifiedBadge, Rating } from "../components/VerifiedBadge.jsx";
import { ID_TYPES } from "../utils/idTypes";
import { isVerified, needsLicense, riderStats } from "../utils/rider";

const FILTERS = [
  ["action", "Needs action"],
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["blocked", "Blocked"],
  ["all", "All"],
];

export default function Admin() {
  const [tab, setTab] = useState("riders");
  const [riders, setRiders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("action");
  const [q, setQ] = useState("");

  useEffect(() => {
    const u1 = onSnapshot(collection(db, "riders"), (s) => setRiders(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => setErr(e.message));
    const u2 = onSnapshot(collection(db, "orders"), (s) => {
      const rows = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOrders(rows);
    }, (e) => setErr(e.message));
    return () => { u1(); u2(); };
  }, []);

  // Applicants appear here only after they verified their email
  const verified = riders.filter((r) => r.emailVerified !== false);
  const unverifiedCount = riders.length - verified.length;

  // identity verified, and licence verified too when it is required (motorbike)
  const bothOk = (r) => r.kycIdentity === "verified" && (r.kycLicense === "verified" || r.kycLicense === "na");
  const needsAction = (r) =>
    r.status === "pending" && (r.kycIdentity === "submitted" || r.kycLicense === "submitted" || bothOk(r));

  const shown = verified
    .filter((r) => (filter === "all" ? true : filter === "action" ? needsAction(r) : r.status === filter))
    .filter((r) => {
      const t = q.trim().toLowerCase();
      return !t || [r.name, r.phone, r.email, r.riderCode].some((x) => String(x || "").toLowerCase().includes(t));
    })
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const countFor = (k) => verified.filter((r) => (k === "all" ? true : k === "action" ? needsAction(r) : r.status === k)).length;
  const openOrders = orders.filter((o) => o.status !== "delivered").length;

  const fail = (e) => setErr(e.message || String(e));

  const setStatus = (r, status) => updateDoc(doc(db, "riders", r.id), { status }).catch(fail);

  // Approve = hand out a rider ID (AK-0001...) the first time
  const approve = async (r) => {
    setErr("");
    if (!bothOk(r)) return setErr("Verify the rider's documents before approving.");
    try {
      if (r.riderCode) return await updateDoc(doc(db, "riders", r.id), { status: "approved" });
      await runTransaction(db, async (t) => {
        const cRef = doc(db, "meta", "riderCounter");
        const c = await t.get(cRef);
        const n = (c.exists() ? c.data().n : 0) + 1;
        t.set(cRef, { n });
        t.update(doc(db, "riders", r.id), {
          status: "approved",
          riderCode: `AK-${String(n).padStart(4, "0")}`,
          approvedAt: serverTimestamp(),
        });
      });
    } catch (e) { fail(e); }
  };

  const review = async (r, type, status, note = "") => {
    setErr("");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "riders", r.id, "kyc", type), { status, note, reviewedAt: serverTimestamp() });
      batch.update(doc(db, "riders", r.id), { [type === "identity" ? "kycIdentity" : "kycLicense"]: status });
      await batch.commit();
    } catch (e) { fail(e); }
  };

  const resetPw = async (r) => {
    setErr(""); setMsg("");
    try {
      await sendPasswordResetEmail(auth, r.email);
      setMsg(`Password reset email sent to ${r.email}.`);
    } catch (e) { fail(e); }
  };

  return (
    <div className="stack">
      <div className="page-title">
        <h1>Admin panel</h1>
        <p className="muted">Review rider applications, verify documents, approve riders and manage orders.</p>
      </div>

      <div className="stats">
        <Stat n={countFor("action")} label="Needs action" hot />
        <Stat n={countFor("approved")} label="Approved riders" />
        <Stat n={countFor("pending")} label="Pending riders" />
        <Stat n={openOrders} label="Open orders" />
      </div>

      <div className="tabs">
        <button className={tab === "riders" ? "on" : ""} onClick={() => setTab("riders")}>Riders ({verified.length})</button>
        <button className={tab === "orders" ? "on" : ""} onClick={() => setTab("orders")}>Orders ({orders.length})</button>
        <button className={tab === "test" ? "on" : ""} onClick={() => setTab("test")}>Test order</button>
        <button className={tab === "wa" ? "on" : ""} onClick={() => setTab("wa")}>WhatsApp</button>
      </div>
      {err && <p className="error">{err}</p>}
      {msg && <p className="notice ok">{msg}</p>}

      {tab === "riders" && (
        <>
          <div className="tabs sub">
            {FILTERS.map(([k, l]) => (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l} ({countFor(k)})</button>
            ))}
          </div>
          <input className="search" placeholder="Search by name, phone, email or rider ID" value={q} onChange={(e) => setQ(e.target.value)} />
          {unverifiedCount > 0 && <p className="muted">{unverifiedCount} sign-up{unverifiedCount > 1 ? "s have" : " has"} not verified the email yet and {unverifiedCount > 1 ? "are" : "is"} hidden.</p>}

          {shown.map((r) => (
            <RiderCard key={r.id} r={r} bothOk={bothOk(r)} stats={riderStats(orders.filter((o) => o.riderId === r.id))} onApprove={approve} onBlock={(x) => setStatus(x, "blocked")}
              onReview={review} onReset={resetPw} onError={fail} />
          ))}
          {shown.length === 0 && <p className="muted center">{verified.length === 0 ? "No rider applications yet." : "No riders in this list."}</p>}
        </>
      )}

      {tab === "orders" && orders.map((o) => (
        <div className="card order" key={o.id}>
          <div className="row between">
            <b>{o.restaurantName}</b>
            <span className={`pill ${o.status}`}>{o.status}</span>
          </div>
          <p>{o.pickupAddress} → {o.dropAddress}</p>
          <p className="muted">₹{o.total} {o.riderName ? `· rider: ${o.riderName}` : ""} {o.source ? `· from ${o.source}` : ""}</p>
          <div><button className="btn small ghost" onClick={() => deleteDoc(doc(db, "orders", o.id)).catch(fail)}>Delete</button></div>
        </div>
      ))}
      {tab === "orders" && orders.length === 0 && <p className="muted center">No orders yet.</p>}

      {tab === "test" && <TestOrder onError={setErr} />}
      {tab === "wa" && <WhatsAppSettings onError={setErr} />}
    </div>
  );
}

function Stat({ n, label, hot }) {
  return (
    <div className={`stat ${hot && n > 0 ? "hot" : ""}`}>
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

function RiderCard({ r, bothOk, stats, onApprove, onBlock, onReview, onReset, onError }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card rider-card">
      <div className="rider-row">
        <SecureImg id={r.photo} />
        <div className="grow">
          <div className="row">
            <b>{r.name}</b>
            {isVerified(r) && <VerifiedBadge />}
            <span className={`pill ${r.status}`}>{r.status}</span>
            {r.riderCode && <span className="pill code">{r.riderCode}</span>}
            {r.online && <span className="pill online">online</span>}
          </div>
          <p className="muted">{fmtPhone(r.phone)} · {r.vehicle}</p>
          <div className="row mini">
            <span className={`pill ${r.kycIdentity || "none"}`}>Identity: {STATUS_TEXT[r.kycIdentity || "none"]}</span>
            {needsLicense(r) && <span className={`pill ${r.kycLicense || "none"}`}>Licence: {STATUS_TEXT[r.kycLicense || "none"]}</span>}
          </div>
          {r.status === "approved" && (
            <p className="muted perf">{stats.deliveries} deliveries · ₹{stats.earned} earned · <Rating value={stats.rating} count={stats.ratingCount} /></p>
          )}
        </div>
        <div className="col actions">
          <button className="btn small ghost" onClick={() => setOpen(!open)}>{open ? "Hide details" : "View details"}</button>
          {r.status !== "approved" && <button className="btn small" disabled={!bothOk} title={bothOk ? "" : "Verify both documents first"} onClick={() => onApprove(r)}>Approve</button>}
          {r.status !== "blocked" && <button className="btn small danger" onClick={() => onBlock(r)}>Block</button>}
        </div>
      </div>
      {open && <RiderDetail r={r} stats={stats} onReview={onReview} onReset={onReset} onError={onError} />}
    </div>
  );
}

function RiderDetail({ r, stats, onReview, onReset, onError }) {
  const when = (t) => (t?.seconds ? new Date(t.seconds * 1000).toLocaleString("en-IN") : "-");
  const rows = [
    ["Rider ID", r.riderCode || "Created when approved"],
    ["Full name", r.name],
    ["Date of birth", r.dob || "-"],
    ["Mobile", fmtPhone(r.phone)],
    ["Email", r.email],
    ["Address", `${r.address || "-"}${r.pin ? " - " + r.pin : ""}`],
    ["Emergency contact", r.emergencyName ? `${r.emergencyName} (${fmtPhone(r.emergencyPhone)})` : "-"],
    ["Vehicle", `${r.vehicle}${r.vehicleNumber ? " · " + r.vehicleNumber : ""}`],
    ["Applied on", when(r.createdAt)],
    ...(r.status === "approved" ? [
      ["Deliveries", `${stats.deliveries} (today ${stats.todayDeliveries})`],
      ["Total earned", `₹${stats.earned} (today ₹${stats.todayEarned})`],
      ["Rating", stats.rating == null ? "No ratings yet" : `${stats.rating.toFixed(1)} / 5 from ${stats.ratingCount} deliveries`],
    ] : []),
  ];
  return (
    <div className="detail">
      <h2>Biodata</h2>
      <dl>{rows.map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>))}</dl>
      <div className="row">
        <button className="btn small ghost" onClick={() => onReset(r)}>Send password reset email</button>
      </div>

      <div className="docs">
        <DocReview type="identity" r={r} onReview={onReview} onError={onError} />
        {needsLicense(r)
          ? <DocReview type="license" r={r} onReview={onReview} onError={onError} />
          : <section className="docbox"><h2>Driving licence</h2><p className="muted">Not required ({r.vehicle}).</p></section>}
      </div>
    </div>
  );
}

function DocReview({ type, r, onReview, onError }) {
  const [d, setD] = useState(undefined);
  const [note, setNote] = useState("");
  const title = type === "identity" ? "Identity proof" : "Driving licence";

  useEffect(
    () => onSnapshot(doc(db, "riders", r.id, "kyc", type), (s) => setD(s.exists() ? s.data() : null), (e) => { setD(null); onError(e); }),
    [r.id, type]
  );

  const status = d?.status || "none";
  return (
    <section className="docbox">
      <div className="row between">
        <h2>{title}</h2>
        <span className={`pill ${status}`}>{STATUS_TEXT[status]}</span>
      </div>
      {d === undefined && <p className="muted">Loading…</p>}
      {d === null && <p className="muted">Not submitted yet.</p>}
      {d && (
        <>
          <p><b>{ID_TYPES[d.idType]?.label || title}</b></p>
          <p><b>Number</b> {d.number}{d.expiry ? ` · valid till ${d.expiry}` : ""}</p>
          <p className="muted">Front</p>
          <SecureImg id={d.front} className="idimg" alt={`${title} front`} openOnClick />
          {d.back && (<><p className="muted">Back</p>
          <SecureImg id={d.back} className="idimg" alt={`${title} back`} openOnClick /></>)}
          <p className="muted">Tap a photo to open the full-size image.</p>
          <WaStatus d={d} riderId={r.id} type={type} onError={onError} />
          <p className="muted">Check that the name and photo match the rider{type === "license" ? " and that the licence has not expired" : ""}.</p>
          {d.status === "rejected" && d.note && <p className="error">Rejected: {d.note}</p>}
          {d.status !== "verified" && (
            <div className="row">
              <button className="btn small" onClick={() => onReview(r, type, "verified")}>Mark verified</button>
            </div>
          )}
          {d.status !== "rejected" && (
            <div className="row reject">
              <input placeholder="Reason (e.g. photo is blurry)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn small danger" disabled={!note.trim()} onClick={() => onReview(r, type, "rejected", note.trim())}>Reject</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TestOrder({ onError }) {
  const [f, setF] = useState({
    restaurantName: "Test Restaurant",
    pickupAddress: "Restaurant road, Kolkata",
    dropAddress: "Customer house, Kolkata",
    customerPhone: "9800000000",
    total: 350,
    deliveryFee: 30,
    paymentMethod: "COD",
    pickupLat: "",
    pickupLng: "",
  });
  const [ok, setOk] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const useMyLocation = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => setF((s) => ({ ...s, pickupLat: p.coords.latitude, pickupLng: p.coords.longitude })),
      () => onError("Location blocked in this browser.")
    );

  const create = async (e) => {
    e.preventDefault();
    setOk("");
    try {
      const data = {
        source: "admin-test",
        restaurantName: f.restaurantName,
        pickupAddress: f.pickupAddress,
        dropAddress: f.dropAddress,
        customerPhone: f.customerPhone,
        total: Number(f.total),
        deliveryFee: Number(f.deliveryFee),
        paymentMethod: f.paymentMethod,
        status: "new",
        riderId: null,
        createdAt: serverTimestamp(),
      };
      if (f.pickupLat !== "") {
        data.pickupLat = Number(f.pickupLat);
        data.pickupLng = Number(f.pickupLng);
      }
      await addDoc(collection(db, "orders"), data);
      setOk("Order created. Riders who are online will see it.");
    } catch (x) {
      onError(x.message);
    }
  };

  return (
    <form className="card narrow" onSubmit={create}>
      <h2>Create a test order</h2>
      <label>Restaurant<input value={f.restaurantName} onChange={set("restaurantName")} required /></label>
      <label>Pickup address<input value={f.pickupAddress} onChange={set("pickupAddress")} required /></label>
      <label>Drop address<input value={f.dropAddress} onChange={set("dropAddress")} required /></label>
      <label>Customer phone<input value={f.customerPhone} onChange={set("customerPhone")} /></label>
      <label>Order total (₹)<input type="number" value={f.total} onChange={set("total")} /></label>
      <label>Delivery fee (₹)<input type="number" value={f.deliveryFee} onChange={set("deliveryFee")} /></label>
      <label>Payment
        <select value={f.paymentMethod} onChange={set("paymentMethod")}>
          <option>COD</option><option>bKash</option><option>Paid</option>
        </select>
      </label>
      <div className="row">
        <input placeholder="Pickup lat (optional)" value={f.pickupLat} onChange={set("pickupLat")} />
        <input placeholder="Pickup lng (optional)" value={f.pickupLng} onChange={set("pickupLng")} />
      </div>
      <button type="button" className="btn ghost" onClick={useMyLocation}>Use my location as pickup</button>
      <button className="btn">Create order</button>
      {ok && <p className="notice">{ok}</p>}
    </form>
  );
}

function WaStatus({ d, riderId, type, onError }) {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const text = { sent: "Photos sent to the admin WhatsApp.", failed: `WhatsApp failed: ${d.waError || "unknown error"}`, "no-number": "No WhatsApp number was saved when this was submitted." }[d.waStatus] || "Not sent to WhatsApp yet.";
  const resend = async () => {
    setBusy(true); setOk(""); onError("");
    try { await api("/api/notify", { method: "POST", body: { kind: type, riderId } }); setOk("Sent."); }
    catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="row">
      <span className="muted">{text}</span>
      <button className="btn small ghost" disabled={busy} onClick={resend}>{busy ? "Sending…" : "Send to WhatsApp again"}</button>
      {ok && <span className="muted">{ok}</span>}
    </div>
  );
}

// The number that receives every rider photo. Stored in Firestore (settings/notify): only admins can read or write it,
// and the server reads it fresh on every send, so a change here takes effect straight away.
function WhatsAppSettings({ onError }) {
  const [saved, setSaved] = useState(undefined);
  const [num, setNum] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => onSnapshot(doc(db, "settings", "notify"), (s) => setSaved(s.exists() ? s.data() : null), (e) => { setSaved(null); onError(e.message); }), []);

  const current = saved?.whatsappNumber ? `+91 ${saved.whatsappNumber.replace(/^91/, "")}` : null;

  const save = async (e) => {
    e.preventDefault();
    setMsg(""); onError("");
    if (!isIndianPhone(num)) return onError("Enter a valid Indian mobile number (10 digits, starts with 6-9).");
    setBusy(true);
    try {
      // ask for the admin's password again, so a stolen open session can't quietly redirect all photos
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pw));
      await setDoc(doc(db, "settings", "notify"), { whatsappNumber: `91${num}`, updatedAt: serverTimestamp(), updatedBy: u.uid });
      setNum(""); setPw("");
      setMsg(`Saved. New rider photos now go to +91 ${num}.`);
    } catch (x) {
      onError(/credential|password/i.test(x.code || x.message) ? "Wrong password." : x.message);
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMsg(""); onError("");
    try { await api("/api/notify", { method: "POST", body: { kind: "test" } }); setMsg("Test message sent. Check WhatsApp."); }
    catch (x) { onError(x.message); }
    finally { setBusy(false); }
  };

  return (
    <form className="card narrow" onSubmit={save}>
      <h2>WhatsApp for rider photos</h2>
      <p className="muted">Every time a rider submits their selfie and ID / licence photos, they are sent to this WhatsApp number. Only admins can see or change it.</p>
      <p><b>Current number:</b> {saved === undefined ? "Loading…" : current || "Not set yet"}</p>
      <label>New WhatsApp number
        <div className="phone-wrap"><span>+91</span>
          <input value={num} onChange={(e) => setNum(cleanPhone(e.target.value))} inputMode="numeric" maxLength={10} placeholder="98XXXXXXXX" required />
        </div>
      </label>
      <label>Your admin password (to confirm)<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></label>
      <button className="btn" disabled={busy}>{busy ? "Please wait…" : "Save number"}</button>
      <button type="button" className="btn ghost" disabled={busy || !current} onClick={test}>Send a test message</button>
      {msg && <p className="notice ok">{msg}</p>}
    </form>
  );
}
