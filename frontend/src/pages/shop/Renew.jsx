import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CreditCard, CheckCircle2, XCircle, Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export function RenewButton({ months = 12, variant = "default", label = "تجديد الاشتراك" }) {
    const [loading, setLoading] = useState(false);
    const go = async () => {
        setLoading(true);
        try {
            const { data } = await api.post("/payments/checkout", { months, origin_url: window.location.origin });
            window.location.href = data.checkout_url;
        } catch (e) { toast.error(formatApiError(e)); setLoading(false); }
    };
    return (
        <Button onClick={go} disabled={loading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" data-testid="renew-subscription-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {label}
        </Button>
    );
}

export function RenewBanner() {
    const { user } = useAuth();
    const exp = user?.shop?.subscription_expires_at;
    if (!exp) return null;
    const days = Math.ceil((new Date(exp) - new Date()) / 86400000);
    if (days > 30) return null;
    const expired = days < 0;
    return (
        <Card className={`p-4 border-2 flex items-center gap-4 ${expired ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}`}>
            <CalendarClock className={`w-8 h-8 ${expired ? "text-rose-600" : "text-amber-600"}`} />
            <div className="flex-1">
                <div className={`font-semibold ${expired ? "text-rose-900" : "text-amber-900"}`}>
                    {expired ? `انتهى الاشتراك منذ ${Math.abs(days)} يوم` : `اشتراكك ينتهي خلال ${days} يوم`}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">جدّد اشتراكك للاستمرار في استخدام النظام بدون انقطاع</div>
            </div>
            <RenewButton months={12} label="جدّد سنة كاملة" />
        </Card>
    );
}

export function RenewSuccess() {
    const [sp] = useSearchParams();
    const nav = useNavigate();
    const { setUser } = useAuth();
    const session_id = sp.get("session_id");
    const [status, setStatus] = useState("polling");
    const [tx, setTx] = useState(null);

    useEffect(() => {
        if (!session_id) { setStatus("error"); return; }
        let attempts = 0;
        const poll = async () => {
            try {
                const { data } = await api.get(`/payments/status/${session_id}`);
                setTx(data);
                if (data.payment_status === "paid") {
                    setStatus("paid");
                    // Refresh user info
                    try { const me = await api.get("/auth/me"); setUser(me.data); } catch {}
                    return;
                }
                if (data.payment_status === "failed" || data.payment_status === "expired") { setStatus("failed"); return; }
                attempts += 1;
                if (attempts > 20) { setStatus("timeout"); return; }
                setTimeout(poll, 2000);
            } catch { setStatus("error"); }
        };
        poll();
    }, [session_id, setUser]);

    return (
        <div className="min-h-screen grid place-items-center bg-zinc-50 p-4" dir="rtl">
            <Card className="max-w-md w-full p-8 text-center">
                {status === "polling" && (<><Loader2 className="w-14 h-14 mx-auto text-blue-600 animate-spin mb-4" /><h2 className="text-xl font-bold text-slate-900">جارٍ تأكيد الدفع…</h2><p className="text-slate-500 mt-2 text-sm">لا تُغلق الصفحة</p></>)}
                {status === "paid" && (<><CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600 mb-4" /><h2 className="text-2xl font-bold text-slate-900">تمّ التجديد بنجاح</h2><p className="text-slate-500 mt-2">مبلغ {fmt(tx?.amount)} USD • تمّ إضافة {tx?.months} شهر</p><Button className="mt-6 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => nav("/dashboard")} data-testid="go-dashboard">الذهاب للوحة التحكم</Button></>)}
                {status === "failed" && (<><XCircle className="w-14 h-14 mx-auto text-rose-600 mb-4" /><h2 className="text-xl font-bold">فشل الدفع</h2><Button className="mt-6" variant="outline" onClick={() => nav("/dashboard")}>عودة</Button></>)}
                {status === "timeout" && (<><Loader2 className="w-14 h-14 mx-auto text-amber-500 mb-4" /><h2 className="text-xl font-bold">التأكيد يستغرق وقتاً</h2><p className="text-slate-500 text-sm mt-2">اذهب للوحة التحكم وستُحدَّث حالة الاشتراك تلقائياً</p><Button className="mt-6 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => nav("/dashboard")}>الذهاب للوحة</Button></>)}
                {status === "error" && (<><XCircle className="w-14 h-14 mx-auto text-rose-600 mb-4" /><h2 className="text-xl font-bold">حدث خطأ</h2><Button className="mt-6" onClick={() => nav("/dashboard")}>عودة</Button></>)}
            </Card>
        </div>
    );
}

export function RenewCancel() {
    const nav = useNavigate();
    return (
        <div className="min-h-screen grid place-items-center bg-zinc-50 p-4" dir="rtl">
            <Card className="max-w-md w-full p-8 text-center">
                <XCircle className="w-14 h-14 mx-auto text-amber-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-900">تمّ إلغاء عملية الدفع</h2>
                <p className="text-slate-500 mt-2 text-sm">لم يتم خصم أي مبلغ. يمكنك المحاولة لاحقاً.</p>
                <Button className="mt-6 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => nav("/dashboard")} data-testid="renew-cancel-back">عودة للوحة</Button>
            </Card>
        </div>
    );
}
