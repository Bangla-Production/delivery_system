import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Layout() {
  const { user, rider, isAdmin, logout } = useAuth();
  const nav = useNavigate();
  const wide = useLocation().pathname.startsWith("/admin");

  const out = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="shell">
      <header className="bar">
        <div className="bar-in">
          <NavLink to="/" className="brand">
            <span className="logo" aria-hidden="true">A</span>
            <span>Abar Khabo <small>Delivery Partner</small></span>
          </NavLink>
          {user && (
            <nav>
              {!isAdmin && <NavLink to="/" end>Home</NavLink>}
              {rider?.status === "approved" && <NavLink to="/accept">Orders</NavLink>}
              {rider?.status === "approved" && <NavLink to="/deliveries">My deliveries</NavLink>}
              {isAdmin && <NavLink to="/admin">Admin panel</NavLink>}
              <button className="link" onClick={out}>Log out</button>
            </nav>
          )}
        </div>
      </header>
      <main className={`page ${wide ? "wide" : ""}`}>
        <Outlet />
      </main>
      <footer className="foot">© {new Date().getFullYear()} Abar Khabo · Delivery Partner</footer>
    </div>
  );
}
