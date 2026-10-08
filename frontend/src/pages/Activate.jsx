import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Crown, KeyRound, ShieldCheck, ArrowLeft } from "lucide-react";

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
        <div dir="rtl" className="min-h-screen bg-[#0a0a0f] relative overflow-hidden flex items-center justify-center p-4">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-yellow-600/10 rounded-full blur-[120px]" />
            </div>
            <div className="relative max-w-md w-full">
                {/* Crest */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 blur-2xl opacity-40" />
                        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-2xl shadow-amber-500/30 ring-1 ring-amber-300/50">
                            <Crown className="w-10 h-10 text-slate-900" strokeWidth={2.5} />
                        </div>
                    </div>
                    <h1 className="mt-4 text-4xl font-black bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-transparent">العرّاب</h1>
                    <p className="text-sm text-amber-200/60 font-medium tracking-widest mt-1">تفعيل نسخة المحل</p>
                </div>

                {/* Card */}
                <form onSubmit={submit} className="rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <KeyRound className="w-5 h-5 text-amber-300" />
                            <h2 className="text-lg font-bold text-white">أدخل كود التفعيل</h2>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">هذا الكود مرفق مع اشتراكك عند شرائك النظام من الإدارة. مثال: <span className="font-mono bg-white/10 px-1.5 rounded text-amber-200">MSK-A9CD-K3F1</span></p>
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
                            className="text-center text-2xl font-mono tabular-nums font-bold tracking-widest h-16 bg-white/5 border-2 border-white/10 text-amber-100 placeholder:text-slate-600 focus:border-amber-400/50 focus:ring-amber-400/20"
                            maxLength={13}
                        />
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70" />
                            كودك مؤمّن وينشّط جهازك فقط
                        </div>
                        <Button type="submit" disabled={busy || code.length < 12}
                            data-testid="activate-submit-btn"
                            className="w-full h-12 bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-900 text-base font-bold shadow-lg shadow-amber-500/20 gap-2 border-0">
                            {busy ? "جارٍ التفعيل…" : "تفعيل النظام"}
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </div>
                </form>

                <div className="text-center mt-6 space-y-2">
                    <a href="/login" className="text-xs text-slate-400 hover:text-amber-200 transition-colors" data-testid="go-to-login">
                        تسجيل دخول بكلمة المرور بدلاً من كود التفعيل ←
                    </a>
                    <p className="text-[11px] text-slate-600">لم تحصل على كود بعد؟ تواصل مع مالك النظام لإصدار اشتراك جديد.</p>
                </div>
            </div>
        </div>
    );
}
