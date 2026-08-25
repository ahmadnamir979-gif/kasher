import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Scale, RefreshCw, Printer } from "lucide-react";
import { toast } from "sonner";

export default function FinancialReports() {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [tab, setTab] = useState("trial");
    const [asOf, setAsOf] = useState(today);
    const [dateFrom, setDateFrom] = useState(monthAgo);
    const [dateTo, setDateTo] = useState(today);
    const [trial, setTrial] = useState(null);
    const [pl, setPl] = useState(null);
    const [bs, setBs] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadTrial = async () => {
        setLoading(true);
        try { const r = await api.get("/accounting/trial-balance", { params: { as_of: asOf } }); setTrial(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
        finally { setLoading(false); }
    };
    const loadPL = async () => {
        setLoading(true);
        try { const r = await api.get("/accounting/profit-loss", { params: { date_from: dateFrom, date_to: dateTo } }); setPl(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
        finally { setLoading(false); }
    };
    const loadBS = async () => {
        setLoading(true);
        try { const r = await api.get("/accounting/balance-sheet", { params: { as_of: asOf } }); setBs(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (tab === "trial") loadTrial();
        else if (tab === "pl") loadPL();
        else if (tab === "bs") loadBS();
        // eslint-disable-next-line
    }, [tab]);

    const doPrint = () => window.print();

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">التقارير المالية</h2>
                    <p className="text-sm text-slate-500">ميزان المراجعة • الأرباح والخسائر • الميزانية العمومية</p>
                </div>
                <Button variant="outline" onClick={doPrint} className="gap-1" data-testid="report-print"><Printer className="w-4 h-4" />طباعة</Button>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="trial" data-testid="tab-trial">ميزان المراجعة</TabsTrigger>
                    <TabsTrigger value="pl" data-testid="tab-pl">الأرباح والخسائر</TabsTrigger>
                    <TabsTrigger value="bs" data-testid="tab-bs">الميزانية العمومية</TabsTrigger>
                </TabsList>

                <TabsContent value="trial">
                    <div className="flex items-center gap-3 mb-3">
                        <label className="text-sm">حتى تاريخ:</label>
                        <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="max-w-xs" />
                        <Button onClick={loadTrial} className="gap-1" data-testid="trial-refresh"><RefreshCw className="w-4 h-4" />تحديث</Button>
                    </div>
                    {trial && (
                        <Card className="p-6 border-zinc-200">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 border-b">
                                    <tr className="text-right text-xs text-slate-600">
                                        <th className="p-3">الرقم</th><th className="p-3">اسم الحساب</th><th className="p-3">مجموع مدين</th><th className="p-3">مجموع دائن</th><th className="p-3">رصيد مدين</th><th className="p-3">رصيد دائن</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trial.rows.map(r => (
                                        <tr key={r.code} className="border-b border-zinc-100">
                                            <td className="p-3 tabular-nums font-mono">{r.code}</td>
                                            <td className="p-3">{r.name}</td>
                                            <td className="p-3 tabular-nums">{fmt(r.debit)}</td>
                                            <td className="p-3 tabular-nums">{fmt(r.credit)}</td>
                                            <td className="p-3 tabular-nums font-semibold">{r.balance_debit > 0 ? fmt(r.balance_debit) : ""}</td>
                                            <td className="p-3 tabular-nums font-semibold">{r.balance_credit > 0 ? fmt(r.balance_credit) : ""}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-zinc-50 font-bold">
                                    <tr>
                                        <td colSpan="4" className="p-3 text-left">الإجماليات</td>
                                        <td className="p-3 tabular-nums">{fmt(trial.total_debit)}</td>
                                        <td className="p-3 tabular-nums">{fmt(trial.total_credit)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div className="mt-4">
                                {trial.balanced ? <Badge className="bg-emerald-100 text-emerald-800">الميزان متوازن ✓</Badge> : <Badge className="bg-rose-100 text-rose-800">الميزان غير متوازن</Badge>}
                            </div>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="pl">
                    <div className="flex items-center gap-3 mb-3">
                        <label className="text-sm">من:</label>
                        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="max-w-xs" />
                        <label className="text-sm">إلى:</label>
                        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="max-w-xs" />
                        <Button onClick={loadPL} className="gap-1" data-testid="pl-refresh"><RefreshCw className="w-4 h-4" />تحديث</Button>
                    </div>
                    {pl && (
                        <Card className="p-6 border-zinc-200">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-bold text-emerald-700 mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" />الإيرادات</h3>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {pl.revenues.map(r => (<tr key={r.code} className="border-b border-zinc-100"><td className="py-2">{r.name}</td><td className="py-2 tabular-nums text-left">{fmt(r.amount)}</td></tr>))}
                                        </tbody>
                                        <tfoot><tr className="bg-emerald-50 font-bold"><td className="p-2">إجمالي الإيرادات</td><td className="p-2 tabular-nums text-left">{fmt(pl.total_revenue)}</td></tr></tfoot>
                                    </table>
                                </div>
                                <div>
                                    <h3 className="font-bold text-rose-700 mb-2">المصروفات</h3>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {pl.expenses.map(r => (<tr key={r.code} className="border-b border-zinc-100"><td className="py-2">{r.name}</td><td className="py-2 tabular-nums text-left">{fmt(r.amount)}</td></tr>))}
                                        </tbody>
                                        <tfoot><tr className="bg-rose-50 font-bold"><td className="p-2">إجمالي المصروفات</td><td className="p-2 tabular-nums text-left">{fmt(pl.total_expenses)}</td></tr></tfoot>
                                    </table>
                                </div>
                            </div>
                            <div className={`mt-6 p-4 rounded-lg text-center text-xl font-bold ${pl.net_profit >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                {pl.net_profit >= 0 ? "صافي الربح" : "صافي الخسارة"}: {fmt(Math.abs(pl.net_profit))}
                            </div>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="bs">
                    <div className="flex items-center gap-3 mb-3">
                        <label className="text-sm">حتى تاريخ:</label>
                        <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="max-w-xs" />
                        <Button onClick={loadBS} className="gap-1" data-testid="bs-refresh"><RefreshCw className="w-4 h-4" />تحديث</Button>
                    </div>
                    {bs && (
                        <Card className="p-6 border-zinc-200">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-bold mb-2 flex items-center gap-2"><Scale className="w-4 h-4" />الأصول</h3>
                                    <table className="w-full text-sm">
                                        <tbody>{bs.assets.map(r => (<tr key={r.code} className="border-b"><td className="py-2">{r.name}</td><td className="py-2 tabular-nums text-left">{fmt(r.amount)}</td></tr>))}</tbody>
                                        <tfoot><tr className="bg-slate-100 font-bold"><td className="p-2">إجمالي الأصول</td><td className="p-2 tabular-nums text-left">{fmt(bs.total_assets)}</td></tr></tfoot>
                                    </table>
                                </div>
                                <div>
                                    <h3 className="font-bold mb-2">الخصوم وحقوق الملكية</h3>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            <tr className="bg-rose-50"><td colSpan="2" className="p-2 font-semibold text-rose-700">الخصوم</td></tr>
                                            {bs.liabilities.map(r => (<tr key={r.code} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 tabular-nums text-left">{fmt(r.amount)}</td></tr>))}
                                            <tr className="bg-rose-100 font-semibold"><td className="p-2">مجموع الخصوم</td><td className="p-2 tabular-nums text-left">{fmt(bs.total_liabilities)}</td></tr>
                                            <tr className="bg-purple-50"><td colSpan="2" className="p-2 font-semibold text-purple-700">حقوق الملكية</td></tr>
                                            {bs.equity.map(r => (<tr key={r.code} className="border-b"><td className="py-2 pr-4">{r.name}</td><td className="py-2 tabular-nums text-left">{fmt(r.amount)}</td></tr>))}
                                            <tr className="bg-purple-100 font-semibold"><td className="p-2">مجموع حقوق الملكية</td><td className="p-2 tabular-nums text-left">{fmt(bs.total_equity)}</td></tr>
                                        </tbody>
                                        <tfoot><tr className="bg-slate-100 font-bold"><td className="p-2">الإجمالي</td><td className="p-2 tabular-nums text-left">{fmt(bs.total_liabilities + bs.total_equity)}</td></tr></tfoot>
                                    </table>
                                </div>
                            </div>
                            <div className="mt-4">
                                {bs.balanced ? <Badge className="bg-emerald-100 text-emerald-800">الميزانية متوازنة ✓</Badge> : <Badge className="bg-rose-100 text-rose-800">فرق في الميزانية</Badge>}
                            </div>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
