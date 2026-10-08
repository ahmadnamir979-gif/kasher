import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { HandCoins, Printer, Filter, X } from "lucide-react";
import SearchSelect from "@/components/SearchSelect";

export default function CustomerStatement() {
    const [customers, setCustomers] = useState([]);
    const [selected, setSelected] = useState("");
    const [data, setData] = useState(null);
    const [payOpen, setPayOpen] = useState(false);
    const [amount, setAmount] = useState(0);
    const [method, setMethod] = useState("cash");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    useEffect(() => { api.get("/customers").then(r => setCustomers(r.data)); }, []);
    const loadStatement = async (cid, df = dateFrom, dt = dateTo) => {
        if (!cid) return setData(null);
        try {
            const qs = [df && `date_from=${df}`, dt && `date_to=${dt}`].filter(Boolean).join("&");
            const r = await api.get(`/customers/${cid}/statement${qs ? "?" + qs : ""}`);
            setData(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { loadStatement(selected); /* eslint-disable-next-line */ }, [selected]);

    const applyFilter = () => loadStatement(selected, dateFrom, dateTo);
    const clearFilter = () => { setDateFrom(""); setDateTo(""); loadStatement(selected, "", ""); };

    const collect = async () => {
        try { await api.post(`/customers/${selected}/payment`, { amount: +amount, method });
            toast.success("تمّ التحصيل"); setPayOpen(false); setAmount(0); loadStatement(selected);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const printPage = () => window.print();

    return (
        <div className="space-y-4">
            <Card className="p-4">
                <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[280px]">
                        <Label>اختر العميل</Label>
                        <SearchSelect value={selected} onChange={setSelected}
                            options={customers.map(c => ({ value: c.id, label: c.name, hint: `رصيد: ${fmt(c.balance || 0)} · ${c.phone || ""}` }))}
                            placeholder="ابحث عن عميل بالاسم أو الهاتف…" testid="cust-select" className="mt-1" />
                    </div>
                    {selected && (<>
                        <div className="w-40"><Label>من تاريخ</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="date-from" /></div>
                        <div className="w-40"><Label>إلى تاريخ</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="date-to" /></div>
                        <Button variant="outline" onClick={applyFilter} className="gap-2" data-testid="apply-filter"><Filter className="w-4 h-4" /> تطبيق</Button>
                        {(dateFrom || dateTo) && <Button variant="outline" onClick={clearFilter} className="gap-2 text-rose-600" data-testid="clear-filter"><X className="w-4 h-4" /> إلغاء</Button>}
                        <Button variant="outline" onClick={printPage} className="gap-2"><Printer className="w-4 h-4" /> طباعة</Button>
                        <Dialog open={payOpen} onOpenChange={setPayOpen}>
                            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="collect-btn"><HandCoins className="w-4 h-4" /> تحصيل مبلغ</Button></DialogTrigger>
                            <DialogContent dir="rtl" className="bg-white">
                                <DialogHeader><DialogTitle>تحصيل مبلغ من العميل</DialogTitle></DialogHeader>
                                <div className="space-y-3">
                                    <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="collect-amount" /></div>
                                    <div><Label>طريقة التحصيل</Label>
                                        <SearchSelect value={method} onChange={setMethod}
                                            options={[{value:"cash",label:"نقدي"},{value:"card",label:"بطاقة"},{value:"bank",label:"بنك"}]}
                                            className="mt-1" /></div>
                                </div>
                                <DialogFooter><Button onClick={collect} className="bg-slate-900 text-white" data-testid="save-collect">حفظ التحصيل</Button></DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </>)}
                </div>
            </Card>
            {data && (
                <Card className="border-zinc-200">
                    <div className="p-5 border-b border-zinc-200 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="font-semibold">كشف حساب — {data.customer.name}</h3>
                            <p className="text-xs text-slate-500">{data.customer.phone || ""}
                                {(data.date_from || data.date_to) && <> · الفترة: {data.date_from || "البداية"} → {data.date_to || "اليوم"}</>}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {(data.date_from || data.date_to) && <>
                                <div className="text-center"><div className="text-xs text-slate-500">إجمالي مدين (الفترة)</div><div className="text-lg font-bold tabular-nums">{fmt(data.period_debit)}</div></div>
                                <div className="text-center"><div className="text-xs text-slate-500">إجمالي دائن (الفترة)</div><div className="text-lg font-bold tabular-nums text-emerald-700">{fmt(data.period_credit)}</div></div>
                            </>}
                            <div className="text-left"><div className="text-xs text-slate-500">الرصيد الحالي</div><div className={`text-2xl font-bold tabular-nums ${data.closing_balance > 0 ? "text-rose-700" : data.closing_balance < 0 ? "text-emerald-700" : ""}`}>{fmt(data.closing_balance)}</div></div>
                        </div>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b text-xs text-slate-600 text-right">
                            <tr><th className="p-3">التاريخ</th><th className="p-3">المرجع</th><th className="p-3">الوصف</th><th className="p-3">مدين</th><th className="p-3">دائن</th><th className="p-3">الرصيد</th></tr>
                        </thead>
                        <tbody>
                            {data.entries.map((e, i) => (
                                <tr key={i} className="border-b border-zinc-100">
                                    <td className="p-3 tabular-nums text-slate-600">{e.date}</td>
                                    <td className="p-3 font-mono text-xs">{e.ref}</td>
                                    <td className="p-3">{e.description}</td>
                                    <td className="p-3 tabular-nums text-slate-900">{e.debit ? fmt(e.debit) : "—"}</td>
                                    <td className="p-3 tabular-nums text-emerald-700">{e.credit ? fmt(e.credit) : "—"}</td>
                                    <td className="p-3 tabular-nums font-semibold">{fmt(e.balance)}</td>
                                </tr>
                            ))}
                            {data.entries.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد حركات في هذه الفترة</td></tr>}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
