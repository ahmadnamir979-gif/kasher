import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut, ChevronLeft } from "lucide-react";

export default function AppShell({ title, sidebar, children, subtitle, actions }) {
    const { user, logout } = useAuth();
    const nav = useNavigate();
    return (
        <div className="min-h-screen flex bg-zinc-50">
            {/* Sidebar (right in RTL) */}
            <aside className="w-64 shrink-0 bg-white border-l border-zinc-200 flex flex-col">
                <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-200">
                    <div className="w-9 h-9 rounded-md bg-slate-900 text-white grid place-items-center font-bold">م</div>
                    <div>
                        <div className="text-sm font-semibold text-slate-900 leading-tight">{user?.shop?.name || "لوحة الإدارة"}</div>
                        <div className="text-xs text-slate-500 leading-tight">{user?.name}</div>
                    </div>
                </div>
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">{sidebar}</nav>
                <button onClick={async () => { await logout(); nav("/login"); }}
                    data-testid="logout-button"
                    className="m-3 flex items-center justify-center gap-2 h-10 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm transition-colors">
                    <LogOut className="w-4 h-4" /> تسجيل خروج
                </button>
            </aside>
            {/* Main */}
            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-16 shrink-0 bg-white border-b border-zinc-200 flex items-center justify-between px-6">
                    <div>
                        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
                        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2">{actions}</div>
                </header>
                <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>
        </div>
    );
}

export function SideLink({ to, icon: Icon, children, active }) {
    return (
        <Link to={to} data-testid={`nav-${to.replace(/\//g, "-")}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-zinc-100"}`}>
            {Icon && <Icon className="w-4 h-4" />} <span className="flex-1">{children}</span>
            {active && <ChevronLeft className="w-3.5 h-3.5" />}
        </Link>
    );
}
