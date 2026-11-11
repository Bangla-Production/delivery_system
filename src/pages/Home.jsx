import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext.jsx";
import KycCard from "../components/KycCard.jsx";
import ChangePassword from "../components/ChangePassword.jsx";
import { VerifiedBadge, Rating } from "../components/VerifiedBadge.jsx";
import { fmtPhone } from "../utils/phone";
import SecureImg from "../components/SecureImg";
import { isVerified, needsLicense, riderStats } from "../utils/rider";

function Stats({ riderId }) {
  const [orders, setOrders] = useState([]);
  useEffect(
    () => onSnapshot(query(collection(db, "orders"), where("riderId", "==", riderId)), (s) => setOrders(s.docs.map((d) => d.data())), () => {}),
    [riderId]
  );
  const st = riderStats(orders);
  return (
    <div className="stats three">
      <div className="stat"><b>{st.deliveries}</b><span>Deliveries done</span></div>
      <div className="stat"><b>₹{st.earned}</b><span>Total earned</span></div>
      <div className="stat"><b>{st.rating == null ? "–" : `★ ${st.rating.toFixed(1)}`}</b><span>{st.ratingCount ? `Rating (${st.ratingCount})` : "No ratings yet"}</span></div>
      <div className="stat soft"><b>{st.todayDeliveries}</b><span>Deliveries today</span></div>
      <div className="stat soft"><b>₹{st.todayEarned}</b><span>Earned today</span></div>
    </div>
  );
}

export default function Home() {
  const { user, rider, isAdmin, adminCheckFailed } = useAuth();

  if (!rider && isAdmin) return <Navigate to="/admin" replace />;

  if (!rider) {
    return (
      <div className="card stack">
        <h1>No delivery partner profile</h1>
        <p className="muted">This account ({user.email}) has no delivery partner profile.</p>
        {adminCheckFailed && (
          <p className="error">Could not check admin access (permission denied). In Firebase → Firestore → Rules, paste the latest <b>firestore.rules</b> and press Publish, then log in again.</p>
        )}
        {!adminCheckFailed && (
          <p className="notice">
            Setting up the admin? In Firestore, the <b>admins</b> collection needs a document whose ID is exactly this user ID:
            <br /><code>{user.uid}</code>
          </p>
        )}
        <div><Link className="btn" to="/register">Register as delivery partner</Link></div>
      </div>
    );
  }

  const idOk = rider.kycIdentity === "verified";
  const licOk = rider.kycLicense === "verified" || rider.kycLicense === "na";
  const lic = needsLicense(rider);
  const verified = isVerified(rider);
  const steps = [
    ["Email verified", true],
    ["Identity verified", idOk],
    ...(lic ? [["Licence verified", licOk]] : []),
    ["Approved by admin", rider.status === "approved"],
  ];

  return (
    <div className="stack">
      <div className="card profile-card">
        <div className="profile">
          <SecureImg id={rider.photo} />
          <div className="grow">
            <div className="row name-row">
              <h1>{rider.name}</h1>
              {verified && <VerifiedBadge />}
            </div>
            <p className="muted">{fmtPhone(rider.phone)} · {rider.vehicle}</p>
            <div className="row">
              <span className={`pill ${rider.status}`}>{rider.status}</span>
              {rider.riderCode && <span className="pill code">ID {rider.riderCode}</span>}
            </div>
          </div>
        </div>

        <ol className="progress" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
          {steps.map(([t, done]) => (
            <li key={t} className={done ? "done" : ""}><span>{done ? "✓" : ""}</span>{t}</li>
          ))}
        </ol>

        {rider.status === "pending" && !verified && (
          <p className="notice">Complete the verification below. After that the admin can approve your account.</p>
        )}
        {rider.status === "pending" && verified && (
          <p className="notice ok">Your documents are verified. Waiting for final admin approval. This page updates by itself.</p>
        )}
        {rider.status === "blocked" && <p className="error">Your account is blocked. Contact the admin.</p>}
        {rider.status === "approved" && (
          <div className="row">
            <Link className="btn" to="/accept">See open orders</Link>
            <Link className="btn ghost" to="/deliveries">My deliveries</Link>
          </div>
        )}
      </div>

      {rider.status === "approved" && (
        <>
          <h3 className="section">Your performance</h3>
          <Stats riderId={rider.id} />
          <p className="muted">Ratings come from customers through the Abar Khabo ordering system.</p>
        </>
      )}

      <h3 className="section">Verification</h3>
      <KycCard type="identity" riderId={rider.id} />
      {lic && <KycCard type="license" riderId={rider.id} />}
      {!lic && <p className="muted">Driving licence is not required for {rider.vehicle === "bicycle" ? "bicycle" : "on-foot"} delivery partners.</p>}

      <h3 className="section">Account</h3>
      <ChangePassword />
    </div>
  );
}
