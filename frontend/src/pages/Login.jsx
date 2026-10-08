import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Crown, KeyRound, ArrowLeft, ShieldCheck } from "lucide-react";

export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [pwd, setPwd] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const r = await login(email, pwd);
        setLoading(false);
        if (!r.ok) return toast.error(r.error);
        toast.success(`أهلاً ${r.user.name}`);
        nav(r.user.role === "super_admin" ? "/admin" : "/pos", { replace: true });
    };

    return (
        <div dir="rtl" className="min-h-screen relative overflow-hidden bg-[#0a0a0f]">
            {/* Ambient background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-yellow-600/10 rounded-full blur-[120px]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
                    backgroundSize: "50px 50px",
                }} />
            </div>

            <div className="relative min-h-screen flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Crest */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 blur-2xl opacity-40" />
                            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-2xl shadow-amber-500/30 ring-1 ring-amber-300/50">
                                <Crown className="w-12 h-12 text-slate-900" strokeWidth={2.5} />
                            </div>
                        </div>
                        <h1 className="mt-6 text-5xl font-black bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-transparent tracking-tight" style={{ letterSpacing: "-0.02em" }}>
                            العرّاب
                        </h1>
                        <p className="mt-2 text-sm text-amber-200/60 font-medium tracking-widest uppercase">Al-Arraab</p>
                    </div>

                    {/* Login card */}
                    <div className="relative rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 p-8 shadow-2xl">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white">تسجيل الدخول</h2>
                            <p className="text-sm text-slate-400 mt-1">أدخل بياناتك للوصول إلى محلك</p>
                        </div>

                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">البريد الإلكتروني</label>
                                <Input
                                    type="email" required
                                    value={email} onChange={(e) => setEmail(e.target.value)}
                                    data-testid="login-email-input"
                                    dir="ltr"
                                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-right focus:border-amber-400/50 focus:ring-amber-400/20"
                                    placeholder="you@example.com" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">كلمة المرور</label>
                                <Input
                                    type="password" required
                                    value={pwd} onChange={(e) => setPwd(e.target.value)}
                                    data-testid="login-password-input"
                                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-amber-400/50 focus:ring-amber-400/20"
                                    placeholder="••••••••" />
                            </div>
                            <Button type="submit" disabled={loading} data-testid="login-submit-button"
                                className="w-full h-12 mt-2 bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-900 text-base font-bold shadow-lg shadow-amber-500/20 gap-2 border-0">
                                {loading ? "جارٍ الدخول…" : "دخول"}
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </form>

                        {/* Activation code shortcut */}
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <a href="/activate" data-testid="go-to-activate"
                                className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-l from-amber-500/10 to-transparent border border-amber-400/20 hover:border-amber-400/40 transition-colors group">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 grid place-items-center">
                                        <KeyRound className="w-4 h-4 text-amber-300" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-white">لديك كود تفعيل؟</div>
                                        <div className="text-[11px] text-slate-400">فعّل نسخة محلك بضغطة واحدة</div>
                                    </div>
                                </div>
                                <ArrowLeft className="w-4 h-4 text-amber-300 group-hover:-translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </div>

                    {/* Trust bar */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70" />
                        <span>اتصال آمن ومشفّر · بياناتك ملكك</span>
                    </div>

                    <div className="mt-3 text-center text-[11px] text-slate-600">© 2026 العرّاب · جميع الحقوق محفوظة</div>
                </div>
            </div>
        </div>
    );
}
