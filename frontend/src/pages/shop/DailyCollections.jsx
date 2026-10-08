import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Printer, FileSpreadsheet, Wallet, CreditCard, Landmark, HandCoins, Send, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const METHOD_LABEL = { cash: "نقدي", card: "بطاقة", bank: "بنك" };
const METHOD_ICON  = { cash: Wallet, card: CreditCard, bank: Landmark };

function todayIso() { return new Date().toISOString().substring(0, 10); }

export default function DailyCollections() {
    const [date, setDate] = useState(todayIso());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get(`/reports/daily-collections?date=${date}`);
            setData(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

    const exportCSV = () => {
        if (!data) return;
        const rows = [
            ["تقرير القبض/الدفع اليومي", date],
            [],
            ["=== المقبوضات ===", "", "", "", "", ""],
            ["الوقت", "النوع", "المرجع", "الطرف", "الطريقة", "المبلغ"],
            ...data.rows_in.map(r => [r.time, r.type, r.ref, r.party, METHOD_LABEL[r.method] || r.method, r.amount]),
            ["", "", "", "", "إجمالي المقبوضات", data.total_in],
            [],
            ["=== المدفوعات ===", "", "", "", "", ""],
            ["الوقت", "النوع", "المرجع", "الطرف", "الطريقة", "المبلغ"],
            ...data.rows_out.map(r => [r.time, r.type, r.ref, r.party, METHOD_LABEL[r.method] || r.method, r.amount]),
            ["", "", "", "", "إجمالي المدفوعات", data.total_out],
            [],
            ["", "", "", "", "صافي الحركة", data.net],
        ];
        const csv = rows.map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `daily-collections-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const printReport = () => window.print();

    const inByMethod = data?.by_method_in || {};
    const outByMethod = data?.by_method_out || {};

    const summary = useMemo(() => data ? [
        { label: "إجمالي المقبوضات", value: data.total_in, color: "emerald", icon: TrendingUp, count: data.count_in },
        { label: "إجمالي المدفوعات", value: data.total_out, color: "rose", icon: TrendingDown, count: data.count_out },
        { label: "صافي الحركة النقدية", value: data.net, color: data.net >= 0 ? "sky" : "amber", icon: Wallet, count: null },
    ] : [], [data]);

    return (
        <div className="space-y-4 print:space-y-2" dir="rtl" data-testid="daily-collections-page">
            {/* Toolbar */}
            <Card className="p-4 print:hidden">
                <div className="flex items-end gap-3 flex-wrap">
                    <div>
                        <Label className="text-xs">تاريخ التقرير</Label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 w-44 tabular-nums" data-testid="dc-date" />
                    </div>
                    <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setDate(todayIso())} data-testid="dc-today">اليوم</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                            const d = new Date(); d.setDate(d.getDate() - 1); setDate(d.toISOString().substring(0, 10));
                        }} data-testid="dc-yesterday">أمس</Button>
                    </div>
                    <div className="flex-1" />
                    <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2" data-testid="dc-export"><FileSpreadsheet className="w-4 h-4" />تصدير CSV</Button>
                    <Button variant="outline" size="sm" onClick={printReport} className="gap-2" data-testid="dc-print"><Printer className="w-4 h-4" />طباعة / PDF</Button>
                </div>
            </Card>

            {/* Header for print */}
            <div className="hidden print:block text-center border-b border-slate-300 pb-3 mb-3">
                <h1 className="text-xl font-black">تقرير القبض / الدفع اليومي</h1>
                <p className="text-sm">تاريخ: {date}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {summary.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={i} className={`bg-gradient-to-l from-${s.color}-50 to-white border border-${s.color}-200 rounded-lg p-4`}>
                            <div className="flex items-center gap-2 text-xs font-semibold mb-1" style={{ color: `var(--${s.color}-700, #334155)` }}>
                                <Icon className="w-4 h-4" /> {s.label}
                            </div>
                            <div className={`tabular-nums text-3xl font-black text-${s.color}-800`}>{fmt(s.value)}</div>
                            {s.count !== null && <div className="text-[11px] text-slate-500 mt-1">{s.count} حركة</div>}
                        </div>
                    );
                })}
            </div>

            {/* By-method breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3 font-semibold text-emerald-800"><ArrowDownToLine className="w-4 h-4" />توزيع المقبوضات حسب طريقة الدفع</div>
                    <div className="grid grid-cols-3 gap-2">
                        {["cash", "card", "bank"].map(m => {
                            const MIcon = METHOD_ICON[m];
                            return (
                                <div key={m} className="border border-zinc-200 rounded p-2 text-center">
                                    <MIcon className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                                    <div className="text-xs text-slate-600">{METHOD_LABEL[m]}</div>
                                    <div className="tabular-nums font-bold text-emerald-700">{fmt(inByMethod[m] || 0)}</div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3 font-semibold text-rose-800"><ArrowUpFromLine className="w-4 h-4" />توزيع المدفوعات حسب طريقة الدفع</div>
                    <div className="grid grid-cols-3 gap-2">
                        {["cash", "card", "bank"].map(m => {
                            const MIcon = METHOD_ICON[m];
                            return (
                                <div key={m} className="border border-zinc-200 rounded p-2 text-center">
                                    <MIcon className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                                    <div className="text-xs text-slate-600">{METHOD_LABEL[m]}</div>
                                    <div className="tabular-nums font-bold text-rose-700">{fmt(outByMethod[m] || 0)}</div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Collections table */}
            <Card className="border-emerald-200">
                <div className="p-4 border-b border-emerald-200 bg-gradient-to-l from-emerald-50 to-white flex items-center gap-2">
                    <HandCoins className="w-5 h-5 text-emerald-700" />
                    <h3 className="font-semibold text-emerald-900">المقبوضات ({data?.count_in || 0})</h3>
                    <div className="flex-1" />
                    <div className="text-sm text-emerald-800">الإجمالي: <strong className="tabular-nums">{fmt(data?.total_in || 0)}</strong></div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-2 w-20">الوقت</th>
                            <th className="p-2">النوع</th>
                            <th className="p-2">المرجع</th>
                            <th className="p-2">الطرف</th>
                            <th className="p-2 w-24">الطريقة</th>
                            <th className="p-2 text-left w-32">المبلغ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data?.rows_in || []).map((r, i) => (
                            <tr key={i} className="border-t border-zinc-100 hover:bg-emerald-50/40" data-testid={`dc-in-${i}`}>
                                <td className="p-2 tabular-nums text-slate-500">{r.time}</td>
                                <td className="p-2">{r.type}</td>
                                <td className="p-2 font-mono text-xs text-slate-600">{r.ref}</td>
                                <td className="p-2">{r.party}</td>
                                <td className="p-2 text-xs">{METHOD_LABEL[r.method] || r.method}</td>
                                <td className="p-2 tabular-nums font-bold text-emerald-700 text-left">{fmt(r.amount)}</td>
                            </tr>
                        ))}
                        {!loading && (data?.rows_in?.length || 0) === 0 && (
                            <tr><td colSpan={6} className="p-6 text-center text-slate-400">لا توجد مقبوضات في هذا اليوم</td></tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Payments table */}
            <Card className="border-rose-200">
                <div className="p-4 border-b border-rose-200 bg-gradient-to-l from-rose-50 to-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-rose-700" />
                    <h3 className="font-semibold text-rose-900">المدفوعات ({data?.count_out || 0})</h3>
                    <div className="flex-1" />
                    <div className="text-sm text-rose-800">الإجمالي: <strong className="tabular-nums">{fmt(data?.total_out || 0)}</strong></div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-2 w-20">الوقت</th>
                            <th className="p-2">النوع</th>
                            <th className="p-2">المرجع</th>
                            <th className="p-2">الطرف</th>
                            <th className="p-2 w-24">الطريقة</th>
                            <th className="p-2 text-left w-32">المبلغ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data?.rows_out || []).map((r, i) => (
                            <tr key={i} className="border-t border-zinc-100 hover:bg-rose-50/40" data-testid={`dc-out-${i}`}>
                                <td className="p-2 tabular-nums text-slate-500">{r.time}</td>
                                <td className="p-2">{r.type}</td>
                                <td className="p-2 font-mono text-xs text-slate-600">{r.ref}</td>
                                <td className="p-2">{r.party}</td>
                                <td className="p-2 text-xs">{METHOD_LABEL[r.method] || r.method}</td>
                                <td className="p-2 tabular-nums font-bold text-rose-700 text-left">{fmt(r.amount)}</td>
                            </tr>
                        ))}
                        {!loading && (data?.rows_out?.length || 0) === 0 && (
                            <tr><td colSpan={6} className="p-6 text-center text-slate-400">لا توجد مدفوعات في هذا اليوم</td></tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Net footer */}
            {data && (
                <Card className={`p-4 border-2 ${data.net >= 0 ? "border-sky-300 bg-sky-50" : "border-amber-300 bg-amber-50"}`}>
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-700 font-semibold">صافي الحركة النقدية لليوم</div>
                        <div className={`tabular-nums text-3xl font-black ${data.net >= 0 ? "text-sky-800" : "text-amber-800"}`} data-testid="dc-net">{fmt(data.net)}</div>
                    </div>
                </Card>
            )}
        </div>
    );
}
