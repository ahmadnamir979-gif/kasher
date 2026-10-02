import { useEffect, useState } from "react";
import { api, fmt, fmtInt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Printer } from "lucide-react";

const ST_LABEL = { monthly: "شهري", daily: "يومي", hourly: "بالساعة" };

export default function Payroll() {
    const [days, setDays] = useState(30);
    const [d, setD] = useState(null);
    useEffect(() => { api.get(`/reports/payroll?days=${days}`).then(r => setD(r.data)); }, [days]);
    if (!d) return <div className="text-slate-500">جارٍ التحميل…</div>;

    return (
        <div className="space-y-4">
            <Card className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h3 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> تقرير رواتب الموظفين</h3>
                        <p className="text-xs text-slate-500 mt-1">الراتب المحسوب حسب نوع الدفع × الأيام ناقص السلف خلال نفس الفترة</p>
                    </div>
                    <div className="flex gap-1 items-center">
                        {[7, 15, 30, 90].map(n => (
                            <Button key={n} size="sm" variant={days === n ? "default" : "outline"} onClick={() => setDays(n)} className={days === n ? "bg-slate-900 hover:bg-slate-800 text-white" : ""} data-testid={`period-${n}`}>{n} يوم</Button>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1 mr-2"><Printer className="w-3.5 h-3.5" /> طباعة</Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-l from-indigo-50 to-white border border-indigo-200 rounded-lg p-4"><div className="text-xs text-indigo-700 font-semibold mb-1">إجمالي الرواتب (قبل السلف)</div><div className="tabular-nums text-2xl font-black text-indigo-800">{fmt(d.totals.gross)}</div></div>
                <div className="bg-gradient-to-l from-amber-50 to-white border border-amber-200 rounded-lg p-4"><div className="text-xs text-amber-700 font-semibold mb-1">إجمالي السلف</div><div className="tabular-nums text-2xl font-black text-amber-800">{fmt(d.totals.loans)}</div></div>
                <div className="bg-gradient-to-l from-emerald-50 to-white border border-emerald-200 rounded-lg p-4"><div className="text-xs text-emerald-700 font-semibold mb-1">صافي المستحق للدفع</div><div className="tabular-nums text-2xl font-black text-emerald-800">{fmt(d.totals.net)}</div></div>
            </div>

            <Card className="border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-3">الموظف</th><th className="p-3">المنصب</th>
                            <th className="p-3">نوع الراتب</th><th className="p-3">الاحتساب</th>
                            <th className="p-3">إجمالي الراتب</th><th className="p-3">السلف</th>
                            <th className="p-3">الصافي</th>
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
                            </tr>
                        ))}
                        {d.rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">لا يوجد موظفين — أضف موظفين من صفحة الموظفين</td></tr>}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
