import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Store, ShieldCheck, LogIn } from "lucide-react";

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
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
            {/* Left branding */}
            <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #3b82f6 0, transparent 50%), radial-gradient(circle at 80% 80%, #10b981 0, transparent 50%)" }} />
                <div className="relative">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-md bg-blue-600 grid place-items-center"><Store className="w-6 h-6" /></div>
                        <div>
                            <div className="font-bold text-xl">نظام إدارة المحلات</div>
                            <div className="text-sm text-slate-300">كاشير + محاسبة + اشتراكات</div>
                        </div>
                    </div>
                </div>
                <div className="relative space-y-6">
                    <h1 className="text-4xl font-bold leading-tight">إدارة كاملة لسوبرماركتك<br/>من واجهة واحدة</h1>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-4 rounded-md bg-white/5 border border-white/10"><div className="font-semibold mb-1">نقطة بيع سريعة</div><div className="text-slate-300">اختصارات لوحة المفاتيح وباركود</div></div>
                        <div className="p-4 rounded-md bg-white/5 border border-white/10"><div className="font-semibold mb-1">مخزون دقيق</div><div className="text-slate-300">حدّ أدنى وأعلى وتنبيهات</div></div>
                        <div className="p-4 rounded-md bg-white/5 border border-white/10"><div className="font-semibold mb-1">تقارير متقدمة</div><div className="text-slate-300">يومية شهرية سنوية وأرباح</div></div>
                        <div className="p-4 rounded-md bg-white/5 border border-white/10"><div className="font-semibold mb-1">صلاحيات</div><div className="text-slate-300">كاشير محاسب مدير</div></div>
                    </div>
                </div>
                <div className="relative text-xs text-slate-400">© 2026 - جميع الحقوق محفوظة</div>
            </div>
            {/* Right form */}
            <div className="flex items-center justify-center p-6 sm:p-12">
                <Card className="w-full max-w-md p-8 border-zinc-200 shadow-sm">
                    <div className="mb-8">
                        <div className="w-12 h-12 rounded-md bg-slate-900 text-white grid place-items-center mb-4"><LogIn className="w-6 h-6" /></div>
                        <h2 className="text-2xl font-bold text-slate-900">تسجيل الدخول</h2>
                        <p className="text-sm text-slate-500 mt-1">ادخل بياناتك للوصول للنظام</p>
                    </div>
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <Label htmlFor="email" className="text-slate-700">البريد الإلكتروني</Label>
                            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                data-testid="login-email-input" className="mt-1.5" placeholder="you@example.com" />
                        </div>
                        <div>
                            <Label htmlFor="pwd" className="text-slate-700">كلمة المرور</Label>
                            <Input id="pwd" type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)}
                                data-testid="login-password-input" className="mt-1.5" placeholder="••••••••" />
                        </div>
                        <Button type="submit" disabled={loading} data-testid="login-submit-button"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11">
                            {loading ? "جارٍ الدخول…" : "دخول"}
                        </Button>
                    </form>
                    <div className="mt-6 p-3 rounded-md bg-blue-50 border border-blue-100 text-xs text-blue-900">
                        <div className="flex items-center gap-2 mb-1 font-semibold"><ShieldCheck className="w-4 h-4" /> حساب المشرف الرئيسي</div>
                        <div className="tabular-nums">admin@pos.com / Admin@1234</div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
