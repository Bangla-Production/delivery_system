import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const NEXT = { accepted: ["picked", "Mark as picked up"], picked: ["delivered", "Mark as delivered"] };

export default function MyDeliveries() {
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = query(collection(db, "orders"), where("riderId", "==", auth.currentUser.uid));
    return onSnapshot(
      q,
      (s) => {
        const rows = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.acceptedAt?.seconds || 0) - (a.acceptedAt?.seconds || 0));
        setOrders(rows);
      },
      (e) => setErr(e.message)
    );
  }, []);

  const advance = async (o) => {
    const [status] = NEXT[o.status];
    try {
      await updateDoc(doc(db, "orders", o.id), {
        status,
        [status + "At"]: serverTimestamp(),
      });
    } catch (e) {
      setErr(e.message);
    }
  };

  const active = orders.filter((o) => o.status !== "delivered");
  const done = orders.filter((o) => o.status === "delivered");
  const earnings = done.reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);

  return (
    <div>
      <div className="card">
        <h1>My deliveries</h1>
        <p className="muted">Completed: {done.length} · Delivery fees earned: ₹{earnings}</p>
      </div>
      {err && <p className="error">{err}</p>}

      {active.length === 0 && <p className="muted center">No active deliveries. Accept one from Orders.</p>}
      {active.map((o) => (
        <div className="card order" key={o.id}>
          <div className="row between">
            <h2>{o.restaurantName || "Order"}</h2>
            <span className={`pill ${o.status}`}>{o.status}</span>
          </div>
          <p><b>Pickup</b> {o.pickupAddress}</p>
          <p><b>Drop</b> {o.dropAddress}</p>
          {o.customerPhone && <p><b>Customer</b> <a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></p>}
          <p className="muted">Collect ₹{o.total} {o.paymentMethod ? `· ${o.paymentMethod}` : ""}</p>
          <button className="btn" onClick={() => advance(o)}>{NEXT[o.status][1]}</button>
        </div>
      ))}

      {done.length > 0 && <h3 className="section">Delivered</h3>}
      {done.map((o) => (
        <div className="card order dim" key={o.id}>
          <b>{o.restaurantName || "Order"}</b> → {o.dropAddress} <span className="muted">· ₹{o.total}</span>
        </div>
      ))}
    </div>
  );
}
