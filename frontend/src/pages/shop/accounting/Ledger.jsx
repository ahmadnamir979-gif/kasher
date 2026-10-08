import { useEffect, useState } from "react";
import { api, formatApiError, fmt, API_URL } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, RefreshCw, Printer } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

export default function Ledger() {
    const [accounts, setAccounts] = useState([]);
    const [selected, setSelected] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const today = new Date().toISOString().slice(0, 10);
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const [dateFrom, setDateFrom] = useState(yearAgo);
    const [dateTo, setDateTo] = useState(today);
    const [params] = useSearchParams();

    useEffect(() => {
        api.get("/accounting/accounts").then(r => {
            const nonGroup = r.data.filter(a => !a.is_group);
            setAccounts(nonGroup);
            const initial = params.get("account_id") || (nonGroup[0]?.id ?? "");
            setSelected(initial);
        }).catch(e => toast.error(formatApiError(e)));
        // eslint-disable-next-line
    }, []);

    const load = async () => {
        if (!selected) return;
        setLoading(true);
        try {
            const r = await api.get(`/accounting/ledger/${selected}`, { params: { date_from: dateFrom, date_to: dateTo } });
            setData(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (selected) load(); /* eslint-disable-next-line */ }, [selected]);

    const acc = data?.account;

    return (
        <div className="space-y-4 print:p-4">
            <div className="flex items-center gap-3 print:hidden">
                <BookOpen className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">دفتر الأستاذ العام</h2>
                    <p className="text-sm text-slate-500">حركة كل قيد على الحساب مع الرصيد المتحرك</p>
                </div>
                <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" />طباعة</Button>
            </div>

            <Card className="p-4 border-zinc-200 print:hidden">
                <div className="grid grid-cols-4 gap-3 items-end">
                    <div className="col-span-2">
                        <label className="text-xs text-slate-600">الحساب</label>
                        <Select value={selected} onValueChange={setSelected}>
                            <SelectTrigger data-testid="ledger-account-select"><SelectValue placeholder="اختر حساباً..." /></SelectTrigger>
                            <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div><label className="text-xs text-slate-600">من</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="ledger-from" /></div>
                    <div className="flex gap-2">
                        <div className="flex-1"><label className="text-xs text-slate-600">إلى</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="ledger-to" /></div>
                        <Button onClick={load} disabled={loading} className="mt-4 gap-1" data-testid="ledger-refresh"><RefreshCw className="w-4 h-4" />تحديث</Button>
                    </div>
                </div>
            </Card>

            {data && acc && (
                <Card className="border-zinc-200">
                    <div className="p-4 border-b bg-slate-50 flex items-center gap-3">
                        <div className="flex-1">
                            <div className="text-xs text-slate-500">الحساب</div>
                            <div className="font-bold text-lg">{acc.code} - {acc.name}</div>
                        </div>
                        <Badge variant="outline" className="text-lg py-1 px-3">النوع: {{"asset":"أصول","liability":"خصوم","equity":"حقوق","revenue":"إيرادات","expense":"مصروفات"}[acc.type]}</Badge>
                        <div className="text-left">
                            <div className="text-xs text-slate-500">الرصيد النهائي</div>
                            <div className={`font-bold text-xl tabular-nums ${data.final_balance >= 0 ? "text-emerald-700" : "text-rose-700"}`} data-testid="ledger-final-balance">{fmt(Math.abs(data.final_balance))}</div>
                        </div>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                            <tr>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3">#القيد</th>
                                <th className="p-3">البيان</th>
                                <th className="p-3">المرجع</th>
                                <th className="p-3">مدين</th>
                                <th className="p-3">دائن</th>
                                <th className="p-3">الرصيد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((r, i) => (
                                <tr key={i} className="border-b border-zinc-100 hover:bg-amber-50/40" data-testid={`ledger-row-${i}`}>
                                    <td className="p-3 tabular-nums">{r.date}</td>
                                    <td className="p-3 font-mono">{r.je_number}</td>
                                    <td className="p-3">{r.description}</td>
                                    <td className="p-3 text-xs text-slate-500">{r.reference || "-"}</td>
                                    <td className="p-3 tabular-nums">{r.debit ? fmt(r.debit) : ""}</td>
                                    <td className="p-3 tabular-nums">{r.credit ? fmt(r.credit) : ""}</td>
                                    <td className="p-3 tabular-nums font-semibold">{fmt(r.balance)}</td>
                                </tr>
                            ))}
                            {data.rows.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">لا حركات على هذا الحساب في الفترة المحددة</td></tr>}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
