import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Guard from "./components/Guard.jsx";
import Login from "./pages/Login.jsx";
import Forgot from "./pages/Forgot.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import Accept from "./pages/Accept.jsx";
import MyDeliveries from "./pages/MyDeliveries.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />

        <Route path="/" element={<Guard need="rider"><Home /></Guard>} />
        <Route path="/accept" element={<Guard need="approved"><Accept /></Guard>} />
        <Route path="/deliveries" element={<Guard need="approved"><MyDeliveries /></Guard>} />
        <Route path="/admin" element={<Guard need="admin"><Admin /></Guard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
