import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, Store, ArrowLeft } from "lucide-react";

// Normalize typing: uppercase, keep only [A-Z0-9-]
function normalize(v) {
    return (v || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}
// Auto-format into MSK-XXXX-XXXX as user types
function formatCode(v) {
    let x = normalize(v).replace(/-/g, "");
    if (!x) return "";
    // Ensure MSK prefix
    if (!x.startsWith("MSK")) x = "MSK" + x;
    x = x.slice(0, 11); // MSK + 8 chars
    const p1 = x.slice(0, 3);
    const p2 = x.slice(3, 7);
    const p3 = x.slice(7, 11);
    return [p1, p2, p3].filter(Boolean).join("-");
}

export default function Activate() {
    const { setUser } = useAuth();
    const nav = useNavigate();
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e?.preventDefault?.();
        if (!code || code.length < 12) return toast.error("أدخل الكود كاملاً");
        setBusy(true);
        try {
            const { data } = await api.post("/activate", { code });
            if (data.token) localStorage.setItem("token", data.token);
            try { localStorage.setItem("cached_user", JSON.stringify(data.user)); } catch {}
            setUser(data.user);
            toast.success(`مرحباً بك في ${data.shop?.name || "النظام"} 🎉`);
            setTimeout(() => nav("/pos"), 400);
        } catch (err) { toast.error(formatApiError(err)); }
        setBusy(false);
    };

    return (
        <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg mb-4">
                        <Store className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-1">Misk POS</h1>
                    <p className="text-sm text-slate-400">تفعيل نسخة المحل</p>
                </div>

                {/* Card */}
                <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-zinc-100">
                        <div className="flex items-center gap-2 mb-1">
                            <KeyRound className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-lg font-bold text-slate-900">أدخل كود التفعيل</h2>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">هذا الكود مرفق مع اشتراكك عند شرائك النظام من الإدارة. مثال: <span className="font-mono bg-slate-100 px-1.5 rounded text-slate-700">MSK-A9CD-K3F1</span></p>
                    </div>

                    <div className="p-6 space-y-4">
                        <Input
                            value={code}
                            onChange={(e) => setCode(formatCode(e.target.value))}
                            data-testid="activation-code-input"
                            autoFocus
                            spellCheck={false}
                            placeholder="MSK-XXXX-XXXX"
                            dir="ltr"
                            className="text-center text-2xl font-mono tabular-nums font-bold tracking-widest h-16 bg-slate-50 border-2"
                            maxLength={13}
                        />
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            كودك مؤمّن وينشّط جهازك فقط
                        </div>
                        <Button type="submit" disabled={busy || code.length < 12}
                            data-testid="activate-submit-btn"
                            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-sm gap-2">
                            {busy ? "جارٍ التفعيل…" : "تفعيل النظام"}
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </div>
                </form>

                <div className="text-center mt-6 space-y-2">
                    <a href="/login" className="text-xs text-slate-400 hover:text-white transition-colors" data-testid="go-to-login">
                        تسجيل دخول بكلمة المرور بدلاً من كود التفعيل ←
                    </a>
                    <p className="text-[11px] text-slate-500">لم تحصل على كود بعد؟ تواصل مع مالك النظام لإصدار اشتراك جديد.</p>
                </div>
            </div>
        </div>
    );
}
