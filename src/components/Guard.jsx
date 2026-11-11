import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// need: "rider" (any logged-in rider/admin), "approved" (approved rider), "admin"
export default function Guard({ need, children }) {
  const { user, rider, isAdmin, loading } = useAuth();

  if (loading) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (need === "admin" && !isAdmin) return <Navigate to="/" replace />;
  if (need === "approved" && rider?.status !== "approved") return <Navigate to="/" replace />;
  return children;
}
