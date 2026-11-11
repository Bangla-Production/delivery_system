import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { signInWithEmailAndPassword, signOut, sendEmailVerification } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext.jsx";
import { niceError } from "../utils/errors";

export default function Login() {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(location.state?.registered ? `We sent a verification link to ${location.state.email}. Open it, then log in here.` : "");
  const [needsVerify, setNeedsVerify] = useState(false);

  if (!loading && user) return <Navigate to={isAdmin ? "/admin" : "/"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setInfo(""); setNeedsVerify(false);
    setBusy(true);
    try {
      const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!u.emailVerified) {
        let admin = false;
        try { admin = (await getDoc(doc(db, "admins", u.uid))).exists(); } catch { /* handled by AuthContext */ }
        if (!admin) {
          await signOut(auth);
          setNeedsVerify(true);
          setErr("Please verify your email first. Open the link we sent to your inbox (check spam too).");
        }
      }
    } catch (x) {
      setErr(niceError(x));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr(""); setInfo(""); setBusy(true);
    try {
      const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(u);
      await signOut(auth);
      setInfo("Verification email sent again. Check your inbox.");
    } catch (x) {
      setErr(niceError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="card stack auth-card" onSubmit={submit}>
        <div className="auth-head">
          <span className="logo big" aria-hidden="true">A</span>
          <h1>Welcome back</h1>
          <p className="muted">Log in to your Abar Khabo delivery partner or admin account.</p>
        </div>
        {info && <p className="notice ok">{info}</p>}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="error">{err}</p>}
        {needsVerify && <button type="button" className="btn ghost" onClick={resend} disabled={busy}>Resend verification email</button>}
        <button className="btn" disabled={busy}>{busy ? "Please wait…" : "Log in"}</button>
        <div className="row between">
          <Link className="forgot" to="/forgot">Forgot password?</Link>
          <span className="muted">New delivery partner? <Link to="/register">Register</Link></span>
        </div>
      </form>
    </div>
  );
}
