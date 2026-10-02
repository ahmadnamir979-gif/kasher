import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut, ChevronLeft, Store } from "lucide-react";
import { ReminderBell } from "@/components/ReminderBell";

export default function AppShell({ title, sidebar, children, subtitle, actions }) {
    const { user, logout } = useAuth();
    const nav = useNavigate();
    return (
        <div className="min-h-screen flex bg-zinc-50">
            {/* Classic Al-Arabi style sidebar (right in RTL) */}
            <aside className="w-72 shrink-0 bg-gradient-to-b from-[#1e3a5f] via-[#243f66] to-[#1a2f4a] text-white flex flex-col shadow-xl">
                {/* Branded header */}
                <div className="px-4 py-4 border-b border-blue-400/20 bg-gradient-to-l from-[#0f2340] to-[#1e3a5f]">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white grid place-items-center shadow-lg ring-2 ring-amber-300/40">
                            <Store className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-base font-bold leading-tight truncate">{user?.shop?.name || "العرّاب"}</div>
                            <div className="text-xs text-blue-200/80 leading-tight truncate">{user?.name || "لوحة الإدارة"}</div>
                        </div>
                    </div>
                </div>
                {/* Information panel header (شاشة المعلومات style) */}
                <div className="px-4 py-2.5 bg-gradient-to-l from-amber-500 to-amber-600 text-white text-xs font-bold flex items-center gap-2 shadow-inner">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    شاشة المعلومات والتنقّل
                </div>
                <nav className="flex-1 py-2 overflow-y-auto custom-scroll">{sidebar}</nav>
                <button onClick={async () => { await logout(); nav("/login"); }}
                    data-testid="logout-button"
                    className="m-3 flex items-center justify-center gap-2 h-11 rounded-lg bg-gradient-to-l from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-sm font-semibold transition-all shadow-md ring-1 ring-rose-400/30">
                    <LogOut className="w-4 h-4" /> تسجيل خروج
                </button>
            </aside>
            {/* Main */}
            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-16 shrink-0 bg-white border-b border-zinc-200 flex items-center justify-between px-6 shadow-sm">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
                        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2">{actions}<ReminderBell /></div>
                </header>
                <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>
            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
                .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }
            `}</style>
        </div>
    );
}

export function SideLink({ to, icon: Icon, children, active }) {
    return (
        <Link to={to} data-testid={`nav-${to.replace(/\//g, "-")}`}
            className={`group flex items-center gap-3 mx-2 my-0.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${active
                ? "bg-gradient-to-l from-amber-400 to-amber-500 text-white shadow-lg border-amber-300 ring-1 ring-amber-200/50"
                : "text-blue-50 hover:bg-white/10 hover:translate-x-0.5 border-transparent hover:border-white/10"
                }`}>
            {Icon && (
                <div className={`w-8 h-8 rounded-md grid place-items-center shrink-0 transition-colors ${active ? "bg-white/25" : "bg-white/5 group-hover:bg-amber-500/20"}`}>
                    <Icon className={`w-4 h-4 ${active ? "text-white" : "text-amber-200 group-hover:text-amber-100"}`} />
                </div>
            )}
            <span className="flex-1 truncate">{children}</span>
            {active && <ChevronLeft className="w-4 h-4 text-white/80" />}
        </Link>
    );
}
