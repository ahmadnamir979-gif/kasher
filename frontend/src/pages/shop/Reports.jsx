import { useEffect, useState } from "react";
import { api, fmt, fmtInt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Reports() {
    const [days, setDays] = useState(30);
    const [d, setD] = useState(null);
    const [dash, setDash] = useState(null);
    useEffect(() => { api.get(`/reports/profit-loss?days=${days}`).then(r => setD(r.data)); }, [days]);
    useEffect(() => { api.get("/reports/dashboard").then(r => setDash(r.data)); }, []);
    if (!d) return <div className="text-slate-500">جارٍ التحميل…</div>;
    const rows = [
        ["الإيرادات (المبيعات)", d.revenue, "text-slate-900"],
        ["تكلفة البضاعة المباعة", -d.cost_of_goods, "text-rose-700"],
        ["مجمل الربح", d.gross_profit, "text-emerald-700 font-bold border-t pt-3"],
        ["المصاريف التشغيلية", -d.expenses, "text-rose-700"],
        ["صافي الربح", d.net_profit, `${d.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"} font-bold text-xl border-t pt-3`],
    ];
    return (
        <div className="space-y-6">
            <Card className="p-5 border-zinc-200">
                <div className="flex items-center justify-between mb-5">
                    <div><h3 className="font-semibold text-slate-900">قائمة الأرباح والخسائر</h3><p className="text-xs text-slate-500">آخر {days} يوم</p></div>
                    <div className="flex gap-1">
                        {[7,30,90,365].map(n => (
                            <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)} className={days === n ? "bg-slate-900 hover:bg-slate-800 text-white" : ""} data-testid={`period-${n}`}>{n === 7 ? "أسبوع" : n === 30 ? "شهر" : n === 90 ? "٣ أشهر" : "سنة"}</Button>
                        ))}
                    </div>
                </div>
                <div className="space-y-3 max-w-2xl">
                    {rows.map(([label, val, cls]) => (
                        <div key={label} className={`flex items-center justify-between ${cls}`}>
                            <span>{label}</span>
                            <span className="tabular-nums">{fmt(val)}</span>
                        </div>
                    ))}
                </div>
            </Card>
            {dash && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="p-5 border-zinc-200">
                        <h3 className="font-semibold text-slate-900 mb-3">اليوم</h3>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div><div className="text-xs text-slate-500">مبيعات</div><div className="text-2xl font-bold tabular-nums">{fmt(dash.today.total)}</div></div>
                            <div><div className="text-xs text-slate-500">فواتير</div><div className="text-2xl font-bold tabular-nums">{fmtInt(dash.today.count)}</div></div>
                            <div><div className="text-xs text-slate-500">ربح</div><div className="text-2xl font-bold tabular-nums text-emerald-700">{fmt(dash.today.profit)}</div></div>
                        </div>
                    </Card>
                    <Card className="p-5 border-zinc-200">
                        <h3 className="font-semibold text-slate-900 mb-3">تنبيهات المخزون</h3>
                        <div className="text-sm text-slate-700">
                            <div>عدد المنتجات: <b className="tabular-nums">{fmtInt(dash.products_count)}</b></div>
                            <div className="mt-2">أصناف تحتاج تجديد: <b className={`tabular-nums ${dash.low_stock > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmtInt(dash.low_stock)}</b></div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
