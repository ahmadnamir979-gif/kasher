import { useEffect, useState } from "react";
import { Routes, Route, Navigate, BrowserRouter, useNavigate, useLocation, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import SuperAdmin from "@/pages/superadmin/SuperAdmin";
import ShopApp from "@/pages/shop/ShopApp";
import "@/App.css";

function Root() {
    const { user, ready } = useAuth();
    if (!ready) return <div className="h-screen flex items-center justify-center text-slate-500">جارٍ التحميل…</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (user.role === "super_admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/pos" replace />;
}

function Protected({ role, children }) {
    const { user, ready } = useAuth();
    if (!ready) return <div className="h-screen flex items-center justify-center text-slate-500">جارٍ التحميل…</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (role === "super_admin" && user.role !== "super_admin") return <Navigate to="/pos" replace />;
    if (role === "shop" && user.role === "super_admin") return <Navigate to="/admin" replace />;
    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster position="top-center" richColors dir="rtl" />
                <Routes>
                    <Route path="/" element={<Root />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/admin/*" element={<Protected role="super_admin"><SuperAdmin /></Protected>} />
                    <Route path="/*" element={<Protected role="shop"><ShopApp /></Protected>} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
