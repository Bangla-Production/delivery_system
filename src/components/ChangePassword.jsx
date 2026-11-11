import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "../firebase";
import { niceError } from "../utils/errors";

export default function ChangePassword() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (next.length < 8) return setMsg({ type: "error", text: "Use at least 8 characters for the new password." });
    if (next !== again) return setMsg({ type: "error", text: "The two new passwords do not match." });
    if (next === cur) return setMsg({ type: "error", text: "New password must be different from the current one." });
    setBusy(true);
    try {
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
      await updatePassword(u, next);
      setCur(""); setNext(""); setAgain("");
      setMsg({ type: "ok", text: "Password changed successfully." });
    } catch (x) {
      setMsg({ type: "error", text: niceError(x) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <div>
        <h2>Change password</h2>
        <p className="muted">Signed in as {auth.currentUser?.email}</p>
      </div>
      <label>Current password<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></label>
      <label>New password<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required /></label>
      <label>Confirm new password<input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required /></label>
      {msg.text && <p className={msg.type === "ok" ? "notice ok" : "error"}>{msg.text}</p>}
      <button className="btn" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>
  );
}
