import { useEffect, useState } from "react";
import { api, fmt, fmtInt, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp, ShoppingBag, Users, Package, Sparkles, Loader2, Trash2, Wallet, Receipt, Landmark, Percent, ClipboardCheck } from "lucide-react";
import { RenewBanner } from "@/pages/shop/Renew";
import { toast } from "sonner";

function Stat({ icon: Icon, label, value, hint, color = "blue" }) {
    const bg = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700", slate: "bg-slate-100 text-slate-700", purple: "bg-purple-50 text-purple-700" }[color];
    return (
        <Card className="p-4 border-zinc-200">
            <div className="flex items-start justify-between mb-3"><div className={`w-9 h-9 rounded-md grid place-items-center ${bg}`}><Icon className="w-4 h-4" /></div></div>
            <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">{label}</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
            {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        </Card>
    );
}

export default function Dashboard() {
    const [d, setD] = useState(null);
    const [kpi, setKpi] = useState(null);
    const [seeding, setSeeding] = useState(false);
    const load = async () => {
        try {
            const [a, b] = await Promise.all([api.get("/reports/dashboard"), api.get("/dashboard/kpis")]);
            setD(a.data); setKpi(b.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
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
    const dailyMax = kpi ? Math.max(...kpi.daily_series.map(x => x.revenue), 1) : 1;
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

            {kpi && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Stat icon={TrendingUp} label="مبيعات اليوم" value={fmt(kpi.today.revenue)} hint={`ربح ${fmt(kpi.today.profit)} • ${fmtInt(kpi.today.count)} فاتورة`} color="emerald" />
                        <Stat icon={ShoppingBag} label="مبيعات الأمس" value={fmt(kpi.yesterday.revenue)} hint={`ربح ${fmt(kpi.yesterday.profit)}`} color="slate" />
                        <Stat icon={TrendingUp} label="مبيعات ٧ أيام" value={fmt(kpi.week.revenue)} hint={`ربح ${fmt(kpi.week.profit)}`} color="blue" />
                        <Stat icon={TrendingUp} label="مبيعات الشهر" value={fmt(kpi.month.revenue)} hint={`ربح ${fmt(kpi.month.profit)}`} color="purple" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Stat icon={Landmark} label="السيولة (نقد + بنك)" value={fmt(kpi.cash_position)} hint="من فهرس الحسابات" color="emerald" />
                        <Stat icon={Wallet} label="مستحقات على العملاء" value={fmt(kpi.receivables.total)} hint={`${kpi.receivables.count} عميل`} color="amber" />
                        <Stat icon={Wallet} label="مستحقات للموردين" value={fmt(kpi.payables.total)} hint={`${kpi.payables.count} مورد`} color="rose" />
                        <Stat icon={Percent} label="ضريبة الشهر" value={fmt(kpi.vat_output_month)} hint="ضريبة مخرجات" color="slate" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Stat icon={Package} label="إجمالي الأصناف" value={fmtInt(kpi.stock.total)} color="slate" />
                        <Stat icon={AlertCircle} label="أصناف على وشك النفاد" value={fmtInt(kpi.stock.low)} hint="أقل من الحد الأدنى" color={kpi.stock.low > 0 ? "amber" : "slate"} />
                        <Stat icon={AlertCircle} label="نفدت من المخزون" value={fmtInt(kpi.stock.out)} color={kpi.stock.out > 0 ? "rose" : "slate"} />
                        <Stat icon={Receipt} label="شيكات معلقة" value={fmtInt(kpi.pending_checks)} color={kpi.pending_checks > 0 ? "amber" : "slate"} />
                    </div>
                </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {kpi && (
                    <Card className="p-5 border-zinc-200">
                        <h3 className="font-semibold text-slate-900 mb-4">أفضل الفئات (شهر)</h3>
                        <div className="space-y-2">
                            {kpi.top_categories.map((c, i) => {
                                const max = Math.max(...kpi.top_categories.map(x => x.revenue), 1);
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-sm text-slate-700 w-32 truncate">{c.name}</span>
                                        <div className="flex-1 bg-zinc-100 rounded-full h-6 overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${(c.revenue / max) * 100}%` }} /></div>
                                        <span className="text-sm font-semibold tabular-nums w-24 text-left">{fmt(c.revenue)}</span>
                                    </div>
                                );
                            })}
                            {kpi.top_categories.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">لا بيانات بعد</div>}
                        </div>
                    </Card>
                )}
                {kpi && (
                    <Card className="p-5 border-zinc-200">
                        <h3 className="font-semibold text-slate-900 mb-4">مبيعات آخر 30 يوم</h3>
                        <div className="flex items-end gap-1 h-40">
                            {kpi.daily_series.slice(-30).map((x, i) => (
                                <div key={i} className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition" style={{ height: `${(x.revenue / dailyMax) * 100}%`, minHeight: "2px" }} title={`${x.date}: ${fmt(x.revenue)}`}></div>
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-2">
                            <span>{kpi.daily_series[0]?.date}</span>
                            <span>{kpi.daily_series[kpi.daily_series.length - 1]?.date}</span>
                        </div>
                    </Card>
                )}
            </div>

            <Card className="p-5 border-zinc-200">
                <h3 className="font-semibold text-slate-900 mb-4">أفضل المنتجات (شهر)</h3>
                <div className="space-y-2">
                    {d.top_products.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded bg-slate-900 text-white text-xs font-bold grid place-items-center">{i + 1}</div>
                                <span className="text-sm text-slate-800">{p._id}</span>
                            </div>
                            <div className="text-left"><div className="tabular-nums font-semibold text-sm">{fmt(p.total)}</div><div className="text-xs text-slate-500 tabular-nums">{p.qty} قطعة</div></div>
                        </div>
                    ))}
                    {d.top_products.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">لا بيانات بعد</div>}
                </div>
            </Card>
        </div>
    );
}
