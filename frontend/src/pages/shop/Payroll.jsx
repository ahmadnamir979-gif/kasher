import { useEffect, useState } from "react";
import { api, fmt, fmtInt, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Printer, FileDown, CheckCircle2, History } from "lucide-react";
import { toast } from "sonner";

const ST_LABEL = { monthly: "شهري", daily: "يومي", hourly: "بالساعة" };

export default function Payroll() {
    const [days, setDays] = useState(30);
    const [d, setD] = useState(null);
    const [history, setHistory] = useState([]);
    const [confirmRow, setConfirmRow] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    const reload = async () => {
        const r = await api.get(`/reports/payroll?days=${days}`); setD(r.data);
        const h = await api.get("/payroll/payments"); setHistory(h.data);
    };
    useEffect(() => { reload(); }, [days]);

    const payRow = async () => {
        try {
            await api.post("/payroll/pay", {
                employee_id: confirmRow.employee_id,
                gross: confirmRow.gross, loans_total: confirmRow.loans_total,
                net: confirmRow.net, period_days: days,
            });
            toast.success(`تمّ صرف راتب ${confirmRow.name} — ${confirmRow.net.toFixed(2)} شيكل · تسوية السلف وتسجيل مصروف تلقائي`);
            setConfirmRow(null); reload();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const exportPDF = () => {
        // Use browser print → user chooses "Save as PDF"
        window.print();
    };

    if (!d) return <div className="text-slate-500">جارٍ التحميل…</div>;

    return (
        <div className="space-y-4" dir="rtl">
            <Card className="p-4 print:hidden">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h3 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> تقرير رواتب الموظفين</h3>
                        <p className="text-xs text-slate-500 mt-1">الراتب حسب نوع الدفع × الأيام ناقص السلف غير المسوّاة</p>
                    </div>
                    <div className="flex gap-1 items-center">
                        {[7, 15, 30, 90].map(n => (
                            <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)} className={days === n ? "bg-slate-900 hover:bg-slate-800 text-white" : ""} data-testid={`period-${n}`}>{n} يوم</Button>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => setShowHistory(true)} className="gap-1 mr-2" data-testid="payroll-history-btn"><History className="w-3.5 h-3.5" /> سجل الصرف</Button>
                        <Button size="sm" variant="outline" onClick={exportPDF} className="gap-1" data-testid="payroll-pdf-btn"><FileDown className="w-3.5 h-3.5" /> تصدير PDF</Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-l from-indigo-50 to-white border border-indigo-200 rounded-lg p-4"><div className="text-xs text-indigo-700 font-semibold mb-1">إجمالي الرواتب (قبل السلف)</div><div className="tabular-nums text-2xl font-black text-indigo-800">{fmt(d.totals.gross)}</div></div>
                <div className="bg-gradient-to-l from-amber-50 to-white border border-amber-200 rounded-lg p-4"><div className="text-xs text-amber-700 font-semibold mb-1">إجمالي السلف غير المسوّاة</div><div className="tabular-nums text-2xl font-black text-amber-800">{fmt(d.totals.loans)}</div></div>
                <div className="bg-gradient-to-l from-emerald-50 to-white border border-emerald-200 rounded-lg p-4"><div className="text-xs text-emerald-700 font-semibold mb-1">صافي المستحق للدفع</div><div className="tabular-nums text-2xl font-black text-emerald-800">{fmt(d.totals.net)}</div></div>
            </div>

            <Card className="border-zinc-200 print:border-0">
                <div className="hidden print:block p-5 border-b"><h2 className="font-black text-2xl text-center">كشف رواتب الموظفين — فترة {days} يوم</h2><p className="text-center text-xs text-slate-500 mt-1">تاريخ الطباعة: {new Date().toLocaleDateString("en-GB")}</p></div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-3">الموظف</th><th className="p-3">المنصب</th>
                            <th className="p-3">نوع الراتب</th><th className="p-3">الاحتساب</th>
                            <th className="p-3">إجمالي الراتب</th><th className="p-3">السلف</th>
                            <th className="p-3">الصافي</th>
                            <th className="p-3 text-left print:hidden">إجراء</th>
                        </tr>
                    </thead>
                    <tbody>
                        {d.rows.map(r => (
                            <tr key={r.employee_id} className="border-b border-zinc-100">
                                <td className="p-3 font-medium">{r.name}</td>
                                <td className="p-3 text-slate-700">{r.position || "—"}</td>
                                <td className="p-3"><Badge className="bg-indigo-100 text-indigo-800">{ST_LABEL[r.salary_type]}</Badge></td>
                                <td className="p-3 text-xs text-slate-500">{r.unit_desc}</td>
                                <td className="p-3 tabular-nums font-semibold">{fmt(r.gross)}</td>
                                <td className="p-3 tabular-nums text-rose-700">{r.loans_count ? `-${fmt(r.loans_total)} (${fmtInt(r.loans_count)})` : "—"}</td>
                                <td className="p-3 tabular-nums font-black text-emerald-700">{fmt(r.net)}</td>
                                <td className="p-3 print:hidden">
                                    {r.net > 0 ? (
                                        <Button size="sm" onClick={() => setConfirmRow(r)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8" data-testid={`pay-emp-${r.employee_id}`}>
                                            <CheckCircle2 className="w-3.5 h-3.5" /> صرف
                                        </Button>
                                    ) : <span className="text-xs text-slate-400">—</span>}
                                </td>
                            </tr>
                        ))}
                        {d.rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">لا يوجد موظفين</td></tr>}
                    </tbody>
                </table>
            </Card>

            {/* Confirm payment dialog */}
            <Dialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-md">
                    <DialogHeader><DialogTitle>تثبيت صرف الراتب</DialogTitle></DialogHeader>
                    {confirmRow && (
                        <div className="space-y-3 text-sm">
                            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded"><b>الموظف:</b> {confirmRow.name}<br /><span className="text-xs text-slate-500">{confirmRow.position || "—"}</span></div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-50 border rounded p-2 text-center"><div className="text-[10px] text-slate-500">الراتب</div><div className="tabular-nums font-bold">{fmt(confirmRow.gross)}</div></div>
                                <div className="bg-rose-50 border border-rose-200 rounded p-2 text-center"><div className="text-[10px] text-rose-600">− السلف</div><div className="tabular-nums font-bold text-rose-700">{fmt(confirmRow.loans_total)}</div></div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-center"><div className="text-[10px] text-emerald-700">= الصافي</div><div className="tabular-nums font-black text-emerald-700">{fmt(confirmRow.net)}</div></div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-800">
                                ⚠️ عند التأكيد سيتم:<br />
                                ١) تسوية كل السلف غير المسوّاة لهذا الموظف<br />
                                ٢) تسجيل مصروف بقيمة الصافي في الصندوق والمحاسبة<br />
                                ٣) إضافة سجل في تاريخ الرواتب
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmRow(null)}>إلغاء</Button>
                        <Button onClick={payRow} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="confirm-payroll"><CheckCircle2 className="w-4 h-4" /> تأكيد الصرف</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History dialog */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent dir="rtl" className="bg-white max-w-3xl">
                    <DialogHeader><DialogTitle>سجل مدفوعات الرواتب — {history.length} عملية</DialogTitle></DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto border rounded">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-right text-xs text-slate-600 sticky top-0">
                                <tr><th className="p-3">التاريخ</th><th className="p-3">الموظف</th><th className="p-3">الفترة</th><th className="p-3">إجمالي</th><th className="p-3">السلف</th><th className="p-3">الصافي</th></tr>
                            </thead>
                            <tbody>
                                {history.map(p => (
                                    <tr key={p.id} className="border-b border-zinc-100">
                                        <td className="p-3 tabular-nums text-slate-600">{p.date}</td>
                                        <td className="p-3 font-medium">{p.employee_name}</td>
                                        <td className="p-3 tabular-nums text-xs">{p.period_days} يوم</td>
                                        <td className="p-3 tabular-nums">{fmt(p.gross)}</td>
                                        <td className="p-3 tabular-nums text-rose-700">{fmt(p.loans_total)}</td>
                                        <td className="p-3 tabular-nums font-black text-emerald-700">{fmt(p.net)}</td>
                                    </tr>
                                ))}
                                {history.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد مدفوعات بعد</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
