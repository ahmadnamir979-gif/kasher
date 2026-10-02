import { useEffect, useState } from "react";
import { api, fmt, fmtInt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function Reports() {
    const [days, setDays] = useState(30);
    const [pl, setPL] = useState(null);
    const [dash, setDash] = useState(null);
    const [daily, setDaily] = useState(null);
    const [top, setTop] = useState(null);
    const [cash, setCash] = useState(null);
    const [byCat, setByCat] = useState(null);
    const [purSum, setPurSum] = useState(null);

    useEffect(() => {
        api.get(`/reports/profit-loss?days=${days}`).then(r => setPL(r.data));
        api.get("/reports/dashboard").then(r => setDash(r.data));
        api.get(`/reports/daily-sales?days=${days}`).then(r => setDaily(r.data));
        api.get(`/reports/top-products?days=${days}`).then(r => setTop(r.data));
        api.get(`/reports/sales-by-cashier?days=${days}`).then(r => setCash(r.data));
        api.get(`/reports/sales-by-category?days=${days}`).then(r => setByCat(r.data));
        api.get(`/reports/purchases-summary?days=${days}`).then(r => setPurSum(r.data));
    }, [days]);

    return (
        <div className="space-y-4">
            <Card className="p-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">تقارير السوبر ماركت</h3>
                    <div className="flex gap-1">
                        {[7, 30, 90, 365].map(n => (
                            <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)} className={days === n ? "bg-slate-900 hover:bg-slate-800 text-white" : ""} data-testid={`period-${n}`}>{n === 7 ? "أسبوع" : n === 30 ? "شهر" : n === 90 ? "٣ أشهر" : "سنة"}</Button>
                        ))}
                    </div>
                </div>
            </Card>
            <Tabs defaultValue="daily" dir="rtl">
                <TabsList className="bg-zinc-100 w-full justify-start flex-wrap h-auto">
                    <TabsTrigger value="daily" data-testid="tab-daily">المبيعات اليومية</TabsTrigger>
                    <TabsTrigger value="top" data-testid="tab-top">الأكثر مبيعاً</TabsTrigger>
                    <TabsTrigger value="category" data-testid="tab-category">حسب الصنف</TabsTrigger>
                    <TabsTrigger value="cashier" data-testid="tab-cashier">حسب الموظف</TabsTrigger>
                    <TabsTrigger value="purchases" data-testid="tab-purchases">المشتريات</TabsTrigger>
                    <TabsTrigger value="pl" data-testid="tab-pl">الأرباح والخسائر</TabsTrigger>
                </TabsList>
                <TabsContent value="daily">
                    <Card className="border-zinc-200">
                        <div className="p-4 border-b"><h4 className="font-semibold">تقرير المبيعات اليومية</h4></div>
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">التاريخ</th><th className="p-3">عدد الفواتير</th><th className="p-3">المبيعات</th><th className="p-3">التكلفة</th><th className="p-3">الربح</th></tr></thead>
                            <tbody>
                                {daily?.rows.map((r, i) => (
                                    <tr key={i} className="border-b border-zinc-100">
                                        <td className="p-3 tabular-nums">{r.date}</td>
                                        <td className="p-3 tabular-nums">{fmtInt(r.count)}</td>
                                        <td className="p-3 tabular-nums font-semibold">{fmt(r.total)}</td>
                                        <td className="p-3 tabular-nums text-slate-500">{fmt(r.cost)}</td>
                                        <td className="p-3 tabular-nums text-emerald-700 font-semibold">{fmt(r.profit)}</td>
                                    </tr>
                                ))}
                                {!daily?.rows?.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد مبيعات</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                <TabsContent value="top">
                    <Card className="border-zinc-200">
                        <div className="p-4 border-b"><h4 className="font-semibold">الأصناف الأكثر مبيعاً</h4></div>
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">#</th><th className="p-3">الصنف</th><th className="p-3">الكمية</th><th className="p-3">إجمالي</th><th className="p-3">عدد مرات</th></tr></thead>
                            <tbody>
                                {top?.rows.map((r, i) => (
                                    <tr key={i} className="border-b border-zinc-100">
                                        <td className="p-3 tabular-nums text-slate-500">{i + 1}</td>
                                        <td className="p-3 font-medium">{r.name}</td>
                                        <td className="p-3 tabular-nums font-bold">{fmt(r.qty)}</td>
                                        <td className="p-3 tabular-nums text-emerald-700">{fmt(r.revenue)}</td>
                                        <td className="p-3 tabular-nums text-slate-500">{fmtInt(r.times)}</td>
                                    </tr>
                                ))}
                                {!top?.rows?.length && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                <TabsContent value="category">
                    <Card className="border-zinc-200">
                        <div className="p-4 border-b"><h4 className="font-semibold">المبيعات حسب الصنف/الفئة</h4></div>
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">الفئة</th><th className="p-3">الكمية</th><th className="p-3">إجمالي المبيعات</th></tr></thead>
                            <tbody>
                                {byCat?.rows.map((r, i) => (
                                    <tr key={i} className="border-b border-zinc-100">
                                        <td className="p-3 font-medium">{r.category}</td>
                                        <td className="p-3 tabular-nums">{fmt(r.qty)}</td>
                                        <td className="p-3 tabular-nums text-emerald-700 font-semibold">{fmt(r.revenue)}</td>
                                    </tr>
                                ))}
                                {!byCat?.rows?.length && <tr><td colSpan={3} className="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                <TabsContent value="cashier">
                    <Card className="border-zinc-200">
                        <div className="p-4 border-b"><h4 className="font-semibold">المبيعات حسب الموظف/الكاشير</h4></div>
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">الموظف</th><th className="p-3">عدد الفواتير</th><th className="p-3">المبيعات</th><th className="p-3">الربح</th></tr></thead>
                            <tbody>
                                {cash?.rows.map((r, i) => (
                                    <tr key={i} className="border-b border-zinc-100">
                                        <td className="p-3 font-medium">{r.cashier}</td>
                                        <td className="p-3 tabular-nums">{fmtInt(r.count)}</td>
                                        <td className="p-3 tabular-nums font-semibold">{fmt(r.total)}</td>
                                        <td className="p-3 tabular-nums text-emerald-700">{fmt(r.profit)}</td>
                                    </tr>
                                ))}
                                {!cash?.rows?.length && <tr><td colSpan={4} className="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                <TabsContent value="purchases">
                    <Card className="border-zinc-200">
                        <div className="p-4 border-b flex justify-between"><h4 className="font-semibold">تقرير المشتريات حسب المورد</h4><span className="text-sm">الإجمالي: <b className="tabular-nums">{fmt(purSum?.total || 0)}</b></span></div>
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">المورد</th><th className="p-3">عدد الفواتير</th><th className="p-3">الإجمالي</th></tr></thead>
                            <tbody>
                                {purSum?.rows.map((r, i) => (
                                    <tr key={i} className="border-b border-zinc-100">
                                        <td className="p-3 font-medium">{r.supplier}</td>
                                        <td className="p-3 tabular-nums">{fmtInt(r.count)}</td>
                                        <td className="p-3 tabular-nums font-semibold">{fmt(r.total)}</td>
                                    </tr>
                                ))}
                                {!purSum?.rows?.length && <tr><td colSpan={3} className="p-8 text-center text-slate-400">لا توجد مشتريات</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                <TabsContent value="pl">
                    {pl && (
                        <Card className="p-5 border-zinc-200">
                            <h4 className="font-semibold mb-4">قائمة الأرباح والخسائر — آخر {days} يوم</h4>
                            <div className="space-y-3 max-w-2xl">
                                <Row label="الإيرادات (المبيعات)" val={pl.revenue} />
                                <Row label="تكلفة البضاعة المباعة" val={-pl.cost_of_goods} cls="text-rose-700" />
                                <Row label="مجمل الربح" val={pl.gross_profit} cls="text-emerald-700 font-bold border-t pt-3" />
                                <Row label="المصاريف التشغيلية" val={-pl.expenses} cls="text-rose-700" />
                                <Row label="صافي الربح" val={pl.net_profit} cls={`${pl.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"} font-bold text-xl border-t pt-3`} />
                            </div>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
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
                        <div>عدد المنتجات: <b className="tabular-nums">{fmtInt(dash.products_count)}</b></div>
                        <div>أصناف تحتاج تجديد: <b className={`tabular-nums ${dash.low_stock > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmtInt(dash.low_stock)}</b></div>
                    </Card>
                </div>
            )}
        </div>
    );
}

function Row({ label, val, cls = "" }) {
    return <div className={`flex items-center justify-between ${cls}`}><span>{label}</span><span className="tabular-nums">{fmt(val)}</span></div>;
}
