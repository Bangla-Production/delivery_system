import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import PhotoBox from "../components/PhotoBox";
import { niceError } from "../utils/errors";
import { cleanPhone, isIndianPhone } from "../utils/phone";
import { regFlag } from "../utils/regFlag";
import { uploadBlob } from "../utils/cloudinary";

const empty = {
  name: "", dob: "", phone: "", emergencyName: "", emergencyPhone: "",
  address: "", pin: "", vehicle: "bicycle", vehicleNumber: "", email: "", password: "",
};

function age(dob) {
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

export default function Register() {
  const nav = useNavigate();
  const [f, setF] = useState(empty);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setPhone = (k) => (e) => setF({ ...f, [k]: cleanPhone(e.target.value) });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!photo) return setErr("Add your own photo (selfie) first.");
    if (!isIndianPhone(f.phone)) return setErr("Enter a valid Indian mobile number (10 digits, starts with 6-9).");
    if (!isIndianPhone(f.emergencyPhone)) return setErr("Emergency contact must also be a valid Indian mobile number.");
    if (f.emergencyPhone === f.phone) return setErr("Emergency contact must be a different number.");
    if (!f.dob || age(f.dob) < 18) return setErr("You must be at least 18 years old.");
    if (!/^\d{6}$/.test(f.pin)) return setErr("PIN code must be 6 digits.");

    setBusy(true);
    regFlag.current = true;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      // the selfie is uploaded privately now that we have an account to sign the upload for
      let photoId;
      try {
        photoId = await uploadBlob(photo.blob, "selfie");
      } catch (up) {
        await user.delete().catch(() => {});
        throw up;
      }
      await setDoc(doc(db, "riders", user.uid), {
        name: f.name.trim(),
        dob: f.dob,
        phone: f.phone,
        emergencyName: f.emergencyName.trim(),
        emergencyPhone: f.emergencyPhone,
        address: f.address.trim(),
        pin: f.pin,
        vehicle: f.vehicle,
        vehicleNumber: f.vehicleNumber.trim().toUpperCase(),
        email: f.email.trim(),
        photo: photoId,
        status: "pending",
        online: false,
        emailVerified: false,   // admin only sees the rider after the email is verified
        kycIdentity: "none",
        kycLicense: f.vehicle === "motorbike" ? "none" : "na", // licence only for motorbike riders
        createdAt: serverTimestamp(),
      });
      await sendEmailVerification(user);
      await signOut(auth);
      regFlag.current = false;
      nav("/login", { replace: true, state: { registered: true, email: f.email.trim() } });
    } catch (x) {
      setErr(niceError(x));
      regFlag.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="card stack auth-card wide-card" onSubmit={submit}>
        <div className="auth-head">
          <span className="logo big" aria-hidden="true">A</span>
          <h1>Become a delivery partner</h1>
          <p className="muted">Fill in your details and verify your email. Then verify your identity with any one government ID (motorbike riders also add a driving licence). An admin approves every delivery partner before orders appear.</p>
        </div>

        <PhotoBox kind="round" slot="selfie" local value={photo} label="Add your photo" onChange={setPhoto} onError={setErr} capture="user" />

        <fieldset className="grp">
          <legend>Personal details</legend>
          <label>Full name (as on ID)<input value={f.name} onChange={set("name")} autoComplete="name" required /></label>
          <div className="grid2">
            <label>Date of birth<input type="date" value={f.dob} onChange={set("dob")} required /></label>
            <label>Mobile number
              <div className="phone-wrap"><span>+91</span>
                <input value={f.phone} onChange={setPhone("phone")} inputMode="numeric" maxLength={10} placeholder="98XXXXXXXX" required />
              </div>
            </label>
          </div>
          <label>Full address<input value={f.address} onChange={set("address")} placeholder="House / street / area / city" required /></label>
          <label>PIN code<input value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} required /></label>
        </fieldset>

        <fieldset className="grp">
          <legend>Emergency contact</legend>
          <div className="grid2">
            <label>Contact name<input value={f.emergencyName} onChange={set("emergencyName")} required /></label>
            <label>Contact mobile
              <div className="phone-wrap"><span>+91</span>
                <input value={f.emergencyPhone} onChange={setPhone("emergencyPhone")} inputMode="numeric" maxLength={10} required />
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset className="grp">
          <legend>Vehicle</legend>
          <label>Type
            <select value={f.vehicle} onChange={set("vehicle")}>
              <option value="bicycle">Bicycle</option>
              <option value="motorbike">Motorbike / Scooter</option>
              <option value="on-foot">On foot</option>
            </select>
          </label>
          {f.vehicle === "motorbike" && (
            <label>Vehicle number<input value={f.vehicleNumber} onChange={set("vehicleNumber")} placeholder="WB 12 AB 1234" required /></label>
          )}
        </fieldset>

        <fieldset className="grp">
          <legend>Account email &amp; password</legend>
          <label>Email<input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>
          <label>Password<input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" minLength={8} required /></label>
          <p className="muted">You will get a verification link by email. You can log in only after you open it.</p>
        </fieldset>

        {err && <p className="error">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        <p className="muted center-text">Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
