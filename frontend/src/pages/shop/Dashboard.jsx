import { useEffect, useState } from "react";
import { api, fmt, fmtInt, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp, ShoppingBag, Users, Package, Sparkles, Loader2, Trash2 } from "lucide-react";
import { RenewBanner } from "@/pages/shop/Renew";
import { toast } from "sonner";

function Stat({ icon: Icon, label, value, hint, color = "blue" }) {
    const bg = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700", slate: "bg-slate-100 text-slate-700" }[color];
    return (
        <Card className="p-5 border-zinc-200">
            <div className="flex items-start justify-between mb-4"><div className={`w-10 h-10 rounded-md grid place-items-center ${bg}`}><Icon className="w-5 h-5" /></div></div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">{label}</div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
            {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        </Card>
    );
}

export default function Dashboard() {
    const [d, setD] = useState(null);
    const [seeding, setSeeding] = useState(false);
    const load = () => api.get("/reports/dashboard").then(r => setD(r.data));
    useEffect(() => { load(); }, []);

    const seedDemo = async () => {
        setSeeding(true);
        try {
            const { data } = await api.post("/dev/seed-demo");
            toast.success(`تمّت إضافة ${data.products} منتج + ${data.categories} فئة + ${data.customers} زبون + ${data.suppliers} مورد`);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
        setSeeding(false);
    };
    const clearDemo = async () => {
        if (!window.confirm("حذف كل البيانات التجريبية؟")) return;
        setSeeding(true);
        try {
            const { data } = await api.delete("/dev/seed-demo");
            toast.success(`تمّ حذف ${data.deleted.products} منتج تجريبي`);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
        setSeeding(false);
    };

    if (!d) return <div className="text-slate-500">جارٍ التحميل…</div>;
    const isEmpty = (d.products_count || 0) < 3;
    return (
        <div className="space-y-6">
            <RenewBanner />
            {isEmpty && (
                <Card className="p-5 border-2 border-blue-200 bg-gradient-to-l from-blue-50 to-white flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-600 text-white grid place-items-center shrink-0"><Sparkles className="w-6 h-6" /></div>
                    <div className="flex-1">
                        <div className="font-bold text-slate-900">جرّب النظام ببيانات جاهزة</div>
                        <div className="text-xs text-slate-600 mt-0.5">أضف 54 منتج + 8 فئات + عملاء وموردين بلمسة واحدة للاختبار الفوري.</div>
                    </div>
                    <Button onClick={seedDemo} disabled={seeding} className="bg-blue-600 hover:bg-blue-700 text-white gap-2" data-testid="seed-demo-btn">
                        {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {seeding ? "جارٍ التحميل…" : "أضف بيانات تجريبية"}
                    </Button>
                </Card>
            )}
            {!isEmpty && (
                <div className="flex justify-end">
                    <Button onClick={clearDemo} disabled={seeding} variant="outline" size="sm" className="text-rose-600 gap-1.5" data-testid="clear-demo-btn"><Trash2 className="w-3.5 h-3.5" /> حذف البيانات التجريبية</Button>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon={TrendingUp} label="مبيعات اليوم" value={fmt(d.today.total)} hint={`${fmtInt(d.today.count)} فاتورة`} color="emerald" />
                <Stat icon={ShoppingBag} label="مبيعات ٧ أيام" value={fmt(d.week.total)} hint={`ربح ${fmt(d.week.profit)}`} color="blue" />
                <Stat icon={Package} label="المنتجات" value={fmtInt(d.products_count)} hint={d.low_stock > 0 ? `${fmtInt(d.low_stock)} صنف قارب على النفاد` : "المخزون بحالة جيدة"} color={d.low_stock > 0 ? "amber" : "slate"} />
                <Stat icon={Users} label="العملاء" value={fmtInt(d.customers_count)} hint="مسجّل في النظام" color="slate" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5 border-zinc-200">
                    <h3 className="font-semibold text-slate-900 mb-4">أفضل المنتجات (شهر)</h3>
                    <div className="space-y-2">
                        {d.top_products.map((p, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded bg-slate-900 text-white text-xs font-bold grid place-items-center">{i+1}</div>
                                    <span className="text-sm text-slate-800">{p._id}</span>
                                </div>
                                <div className="text-left"><div className="tabular-nums font-semibold text-sm">{fmt(p.total)}</div><div className="text-xs text-slate-500 tabular-nums">{p.qty} قطعة</div></div>
                            </div>
                        ))}
                        {d.top_products.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">لا بيانات بعد</div>}
                    </div>
                </Card>
                <Card className="p-5 border-zinc-200">
                    <h3 className="font-semibold text-slate-900 mb-4">مبيعات آخر ٧ أيام</h3>
                    <div className="space-y-2">
                        {d.daily_sales.map(x => {
                            const max = Math.max(...d.daily_sales.map(y => y.total), 1);
                            return (
                                <div key={x._id} className="flex items-center gap-3">
                                    <span className="text-xs text-slate-500 tabular-nums w-20">{x._id}</span>
                                    <div className="flex-1 bg-zinc-100 rounded-full h-6 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${(x.total/max)*100}%` }} /></div>
                                    <span className="text-sm font-semibold tabular-nums w-24 text-left">{fmt(x.total)}</span>
                                </div>
                            );
                        })}
                        {d.daily_sales.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">لا مبيعات بعد</div>}
                    </div>
                </Card>
            </div>
        </div>
    );
}
