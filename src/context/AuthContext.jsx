import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { regFlag } from "../utils/regFlag";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [rider, setRider] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckFailed, setAdminCheckFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubRider = () => {};
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      unsubRider();
      if (!u) {
        setUser(null);
        setRider(null);
        setIsAdmin(false);
        setAdminCheckFailed(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      let admin = false;
      let failed = false;
      try {
        admin = (await getDoc(doc(db, "admins", u.uid))).exists();
      } catch {
        failed = true; // usually: Firestore rules not published yet
      }
      // Riders must verify their email first. (Admins are created in the console, so they are exempt.)
      if (!failed && !admin && !u.emailVerified && !regFlag.current) {
        await signOut(auth);
        return;
      }
      setUser(u);
      setIsAdmin(admin);
      setAdminCheckFailed(failed);

      // Live rider profile so approval / document review shows up without a refresh
      unsubRider = onSnapshot(
        doc(db, "riders", u.uid),
        (s) => {
          if (s.exists()) {
            const data = { id: s.id, ...s.data() };
            setRider(data);
            // first verified login: mark the profile as email-verified so the admin can see it
            if (data.emailVerified === false && u.emailVerified) {
              updateDoc(doc(db, "riders", u.uid), { emailVerified: true, verifiedAt: serverTimestamp() }).catch(() => {});
            }
          } else {
            setRider(null);
          }
          setLoading(false);
        },
        () => setLoading(false)
      );
    });
    return () => {
      unsubRider();
      unsubAuth();
    };
  }, []);

  const logout = () => signOut(auth);

  return (
    <Ctx.Provider value={{ user, rider, isAdmin, adminCheckFailed, loading, logout }}>
      {children}
    </Ctx.Provider>
  );
}
