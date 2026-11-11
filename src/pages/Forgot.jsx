import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { niceError } from "../utils/errors";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setDone(true);
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
          <h1>Forgot password?</h1>
          <p className="muted">Enter the email you registered with. We will send you a link to set a new password.</p>
        </div>
        {done ? (
          <p className="notice ok">If <b>{email}</b> is registered, a reset link is on its way. Check your inbox and spam folder.</p>
        ) : (
          <>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
            {err && <p className="error">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </>
        )}
        <p className="muted center-text"><Link to="/login">← Back to log in</Link></p>
      </form>
    </div>
  );
}
