import { useEffect, useState } from "react";
import { api, fmt, fmtInt } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ShoppingCart, Users, Receipt, Wallet, CreditCard, HandCoins, Truck, AlertTriangle, Clock, Award, PackageMinus, Bell } from "lucide-react";

export default function Dashboard() {
    const [d, setD] = useState(null);
    const nav = useNavigate();
    useEffect(() => { api.get("/dashboard/summary").then(r => setD(r.data)); }, []);
    if (!d) return <div className="text-slate-500">جارٍ تحميل لوحة التحكم…</div>;

    const momPct = d.prev_month.total > 0 ? ((d.month.total - d.prev_month.total) / d.prev_month.total) * 100 : 0;
    const yestPct = d.yesterday.total > 0 ? ((d.today.total - d.yesterday.total) / d.yesterday.total) * 100 : 0;

    const maxChart = Math.max(1, ...d.chart_14d.map(x => x.total));

    return (
        <div className="space-y-4">
            {/* Row 1: Big numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <KPI icon={ShoppingCart} color="emerald" label="مبيعات اليوم" value={fmt(d.today.total)}
                     sub={<CompareBadge pct={yestPct} />} onClick={() => nav("/sales")} testid="kpi-today" />
                <KPI icon={ShoppingCart} color="slate" label="مبيعات أمس" value={fmt(d.yesterday.total)}
                     sub={`${fmtInt(d.yesterday.count)} فاتورة`} onClick={() => nav("/sales")} testid="kpi-yest" />
                <KPI icon={TrendingUp} color="amber" label="ربح اليوم" value={fmt(d.today.profit)}
                     sub="صافي" onClick={() => nav("/reports")} testid="kpi-profit" />
                <KPI icon={Receipt} color="indigo" label="عدد فواتير اليوم" value={fmtInt(d.today.count)}
                     sub={`متوسط: ${fmt(d.today.avg_invoice)}`} onClick={() => nav("/sales")} testid="kpi-count" />
                <KPI icon={Users} color="blue" label="عدد العملاء" value={fmtInt(d.customers_count)}
                     sub="مسجّلين" onClick={() => nav("/customers")} testid="kpi-customers" />
                <KPI icon={HandCoins} color="rose" label="إجمالي الديون" value={fmt(d.debts)}
                     sub="على العملاء" onClick={() => nav("/customer-statement")} testid="kpi-debts" />
            </div>

            {/* Row 2: Payments & Purchases */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI icon={Wallet} color="emerald" label="النقد بالصندوق" value={fmt(d.cash_in_drawer)}
                     onClick={() => nav("/cashbox")} testid="kpi-cash" />
                <KPI icon={Wallet} color="emerald" label="مبيعات نقدية اليوم" value={fmt(d.today.cash)}
                     onClick={() => nav("/cashbox")} testid="kpi-cash-today" />
                <KPI icon={CreditCard} color="blue" label="مبيعات البطاقات" value={fmt(d.today.card)}
                     onClick={() => nav("/sales")} testid="kpi-card" />
                <KPI icon={Truck} color="violet" label="مشتريات اليوم" value={fmt(d.purchases_today.total)}
                     sub={`${fmtInt(d.purchases_today.count)} فاتورة`} onClick={() => nav("/purchases")} testid="kpi-pur" />
            </div>

            {/* Row 3: Inventory alerts */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KPI icon={PackageMinus} color="rose" label="أصناف ناقصة" value={fmtInt(d.low_stock_count)}
                     sub="تحت الحد الأدنى" onClick={() => nav("/products")} testid="kpi-low" />
                <KPI icon={Clock} color="orange" label="قاربت على الانتهاء" value={fmtInt(d.near_expiry_count)}
                     sub="خلال 30 يوم" onClick={() => nav("/expiry")} testid="kpi-expiry" />
                <KPI icon={Bell} color="amber" label="تنبيهات مهمة" value={fmtInt(d.alerts.length)}
                     sub="اضغط للتفاصيل" onClick={() => nav("/assistant")} testid="kpi-alerts" />
            </div>

            {/* Row 4: Chart + Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-5 lg:col-span-2">
                    <h3 className="font-semibold mb-3">المبيعات — آخر 14 يوم</h3>
                    <div className="flex items-end gap-1 h-40">
                        {d.chart_14d.map((r, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer" title={`${r.date}: ${fmt(r.total)}`}>
                                <div className="w-full bg-gradient-to-t from-amber-500 to-amber-300 hover:from-amber-600 hover:to-amber-400 rounded-t transition-all"
                                     style={{ height: `${(r.total / maxChart) * 100}%`, minHeight: "4px" }} />
                                <div className="text-[9px] text-slate-500 mt-1 rotate-45 origin-left">{r.date.substring(5)}</div>
                            </div>
                        ))}
                        {d.chart_14d.length === 0 && <div className="w-full text-center text-slate-400 self-center">لا توجد بيانات بعد</div>}
                    </div>
                </Card>
                <Card className="p-5">
                    <h3 className="font-semibold mb-3">هذا الشهر vs السابق</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">هذا الشهر</span>
                            <span className="tabular-nums font-bold">{fmt(d.month.total)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">الشهر السابق</span>
                            <span className="tabular-nums text-slate-500">{fmt(d.prev_month.total)}</span>
                        </div>
                        <div className="pt-3 border-t flex justify-between items-center">
                            <span className="text-sm font-semibold">التغيّر</span>
                            <CompareBadge pct={momPct} big />
                        </div>
                        <div className="pt-2">
                            <div className="text-xs text-slate-500">ربح هذا الشهر</div>
                            <div className="text-xl font-bold tabular-nums text-emerald-700">{fmt(d.month.profit)}</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Row 5: Top 10 + Least */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2"><Award className="w-4 h-4 text-amber-600" /> أفضل 10 أصناف هذا الشهر</h3>
                        <button onClick={() => nav("/reports")} className="text-xs text-blue-600 hover:underline">عرض الكل</button>
                    </div>
                    {d.top10.length === 0 ? <div className="text-slate-400 text-center py-6">لا توجد مبيعات بعد</div> : (
                        <table className="w-full text-sm">
                            <tbody>
                                {d.top10.map((p, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        <td className="p-2 w-8 text-slate-400 tabular-nums">{i + 1}</td>
                                        <td className="p-2 font-medium">{p.name}</td>
                                        <td className="p-2 tabular-nums text-left"><Badge className="bg-amber-100 text-amber-800">{fmt(p.qty)}</Badge></td>
                                        <td className="p-2 tabular-nums text-left text-emerald-700 font-semibold">{fmt(p.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
                <Card className="p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2"><TrendingDown className="w-4 h-4 text-rose-600" /> أقل الأصناف حركة</h3>
                        <button onClick={() => nav("/dead-stock")} className="text-xs text-blue-600 hover:underline">الراكد →</button>
                    </div>
                    {d.least_active.length === 0 ? <div className="text-slate-400 text-center py-6">لا توجد بيانات</div> : (
                        <table className="w-full text-sm">
                            <tbody>
                                {d.least_active.map((p, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        <td className="p-2 font-medium">{p.name}</td>
                                        <td className="p-2 tabular-nums text-left"><Badge className="bg-rose-100 text-rose-800">{fmt(p.qty)}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>

            {/* Alerts */}
            {d.alerts.length > 0 && (
                <Card className="p-5 border-amber-300 bg-amber-50">
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-900"><AlertTriangle className="w-4 h-4" /> تنبيهات مهمة</h3>
                    <div className="space-y-2">
                        {d.alerts.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <Badge className={a.severity === "warn" ? "bg-rose-600" : "bg-blue-600"}>{a.type}</Badge>
                                <span>{a.message}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

function KPI({ icon: Icon, color, label, value, sub, onClick, testid }) {
    const colors = {
        emerald: "border-emerald-500 bg-emerald-50 text-emerald-700",
        slate: "border-slate-400 bg-slate-50 text-slate-700",
        amber: "border-amber-500 bg-amber-50 text-amber-800",
        indigo: "border-indigo-500 bg-indigo-50 text-indigo-700",
        blue: "border-blue-500 bg-blue-50 text-blue-700",
        rose: "border-rose-500 bg-rose-50 text-rose-700",
        violet: "border-violet-500 bg-violet-50 text-violet-700",
        orange: "border-orange-500 bg-orange-50 text-orange-700",
    }[color] || "border-slate-400 bg-slate-50 text-slate-700";
    return (
        <button onClick={onClick} data-testid={testid}
            className={`text-right p-4 rounded-lg border-r-4 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all shadow-sm ${colors.split(" ")[0]}`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="text-xs text-slate-500 mb-1">{label}</div>
                    <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
                    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
                </div>
                <div className={`p-2 rounded-md ${colors.split(" ").slice(1).join(" ")}`}><Icon className="w-5 h-5" /></div>
            </div>
        </button>
    );
}

function CompareBadge({ pct, big }) {
    const up = pct >= 0;
    return (
        <span className={`inline-flex items-center gap-1 ${big ? "text-lg" : "text-xs"} font-semibold ${up ? "text-emerald-700" : "text-rose-700"}`}>
            {up ? <TrendingUp className={big ? "w-5 h-5" : "w-3 h-3"} /> : <TrendingDown className={big ? "w-5 h-5" : "w-3 h-3"} />}
            {Math.abs(pct).toFixed(1)}%
        </span>
    );
}
