import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, where, onSnapshot, doc, runTransaction, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext.jsx";
import { distanceKm, fmtKm } from "../utils/geo";

const MAX_KM = 8; // only show orders whose pickup is within this distance (if the order has coordinates)

export default function Accept() {
  const { rider } = useAuth();
  const [online, setOnline] = useState(false);
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState("");
  const [orders, setOrders] = useState([]);
  const [busyId, setBusyId] = useState("");
  const watchId = useRef(null);
  const lastWrite = useRef(0);

  // --- location permission + live position (starts only when the rider taps "Go online") ---
  const goOnline = () => {
    setErr("");
    if (!navigator.geolocation) return setErr("This device does not support location.");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(loc);
        setOnline(true);
        // save location to Firestore at most every 15 seconds
        if (Date.now() - lastWrite.current > 15000) {
          lastWrite.current = Date.now();
          updateDoc(doc(db, "riders", auth.currentUser.uid), { ...loc, online: true, updatedAt: serverTimestamp() }).catch(() => {});
        }
      },
      (e) => {
        setOnline(false);
        setErr(
          e.code === 1
            ? "Location is blocked. Allow location for this site in your browser settings, then tap Go online again."
            : "Could not get your location. Check GPS and try again."
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  };

  const goOffline = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setOnline(false);
    setPos(null);
    updateDoc(doc(db, "riders", auth.currentUser.uid), { online: false, updatedAt: serverTimestamp() }).catch(() => {});
  };

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  // --- live list of open orders (only while online) ---
  useEffect(() => {
    if (!online) return setOrders([]);
    const q = query(collection(db, "orders"), where("status", "==", "new"));
    return onSnapshot(
      q,
      (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setErr(e.code === "permission-denied" ? "You are not approved to see orders." : e.message)
    );
  }, [online]);

  const list = useMemo(() => {
    return orders
      .map((o) => ({
        ...o,
        km: o.pickupLat != null ? distanceKm(pos, { lat: o.pickupLat, lng: o.pickupLng }) : null,
      }))
      .filter((o) => o.km == null || o.km <= MAX_KM)
      .sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
  }, [orders, pos]);

  const accept = async (id) => {
    if (!pos) return setErr("Turn on location first.");
    setBusyId(id);
    setErr("");
    try {
      await runTransaction(db, async (t) => {
        const ref = doc(db, "orders", id);
        const snap = await t.get(ref);
        if (!snap.exists() || snap.data().status !== "new") throw new Error("Another rider already took this order.");
        t.update(ref, {
          status: "accepted",
          riderId: auth.currentUser.uid,
          riderName: rider.name,
          riderPhone: rider.phone,
          acceptedAt: serverTimestamp(),
          acceptedLat: pos.lat,
          acceptedLng: pos.lng,
        });
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <div className="card row between">
        <div>
          <h1>Open orders</h1>
          <p className="muted">{online ? "You are online. Orders within " + MAX_KM + " km show here." : "Go online to share your location and see orders."}</p>
        </div>
        {online ? (
          <button className="btn ghost" onClick={goOffline}>Go offline</button>
        ) : (
          <button className="btn" onClick={goOnline}>Go online</button>
        )}
      </div>

      {err && <p className="error">{err}</p>}

      {online && list.length === 0 && <p className="muted center">No open orders right now. New ones appear here automatically.</p>}

      {list.map((o) => (
        <div className="card order" key={o.id}>
          <div className="row between">
            <h2>{o.restaurantName || "Order"}</h2>
            {o.km != null && <span className="pill">{fmtKm(o.km)} away</span>}
          </div>
          <p><b>Pickup</b> {o.pickupAddress}</p>
          <p><b>Drop</b> {o.dropAddress}</p>
          <p className="muted">Total ₹{o.total} {o.paymentMethod ? `· ${o.paymentMethod}` : ""}</p>
          <button className="btn" disabled={busyId === o.id} onClick={() => accept(o.id)}>
            {busyId === o.id ? "Accepting…" : "Accept order"}
          </button>
        </div>
      ))}
    </div>
  );
}
