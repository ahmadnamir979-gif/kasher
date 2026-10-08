import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Send, Printer, Filter, X } from "lucide-react";
import SearchSelect from "@/components/SearchSelect";

export default function SupplierStatement() {
    const [suppliers, setSuppliers] = useState([]);
    const [selected, setSelected] = useState("");
    const [data, setData] = useState(null);
    const [payOpen, setPayOpen] = useState(false);
    const [amount, setAmount] = useState(0);
    const [method, setMethod] = useState("cash");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    useEffect(() => { api.get("/suppliers").then(r => setSuppliers(r.data)); }, []);
    const load = async (sid, df = dateFrom, dt = dateTo) => {
        if (!sid) return setData(null);
        try {
            const qs = [df && `date_from=${df}`, dt && `date_to=${dt}`].filter(Boolean).join("&");
            const r = await api.get(`/suppliers/${sid}/statement${qs ? "?" + qs : ""}`);
            setData(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(selected); /* eslint-disable-next-line */ }, [selected]);
    const applyFilter = () => load(selected, dateFrom, dateTo);
    const clearFilter = () => { setDateFrom(""); setDateTo(""); load(selected, "", ""); };

    const pay = async () => {
        try { await api.post(`/suppliers/${selected}/payment`, { amount: +amount, method });
            toast.success("تمّ التسديد"); setPayOpen(false); setAmount(0); load(selected);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <Card className="p-4">
                <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[280px]">
                        <Label>اختر المورد</Label>
                        <SearchSelect value={selected} onChange={setSelected}
                            options={suppliers.map(s => ({ value: s.id, label: s.name, hint: `رصيد: ${fmt(s.balance || 0)} · ${s.phone || ""}` }))}
                            placeholder="ابحث عن مورد بالاسم أو الهاتف…" testid="sup-select" className="mt-1" />
                    </div>
                    {selected && (<>
                        <div className="w-40"><Label>من تاريخ</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="date-from" /></div>
                        <div className="w-40"><Label>إلى تاريخ</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="date-to" /></div>
                        <Button variant="outline" onClick={applyFilter} className="gap-2" data-testid="apply-filter"><Filter className="w-4 h-4" /> تطبيق</Button>
                        {(dateFrom || dateTo) && <Button variant="outline" onClick={clearFilter} className="gap-2 text-rose-600" data-testid="clear-filter"><X className="w-4 h-4" /> إلغاء</Button>}
                        <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" /> طباعة</Button>
                        <Dialog open={payOpen} onOpenChange={setPayOpen}>
                            <DialogTrigger asChild><Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2" data-testid="pay-btn"><Send className="w-4 h-4" /> تسديد للمورد</Button></DialogTrigger>
                            <DialogContent dir="rtl" className="bg-white">
                                <DialogHeader><DialogTitle>تسديد لحساب المورد</DialogTitle></DialogHeader>
                                <div className="space-y-3">
                                    <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="pay-amount" /></div>
                                    <div><Label>طريقة الدفع</Label>
                                        <SearchSelect value={method} onChange={setMethod}
                                            options={[{value:"cash",label:"نقدي"},{value:"card",label:"بطاقة"},{value:"bank",label:"بنك"}]}
                                            className="mt-1" /></div>
                                </div>
                                <DialogFooter><Button onClick={pay} className="bg-slate-900 text-white" data-testid="save-pay">حفظ التسديد</Button></DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </>)}
                </div>
            </Card>
            {data && (
                <Card className="border-zinc-200">
                    <div className="p-5 border-b border-zinc-200 flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h3 className="font-semibold">كشف حساب — {data.supplier.name}</h3>
                            <p className="text-xs text-slate-500">{data.supplier.phone || ""}
                                {(data.date_from || data.date_to) && <> · الفترة: {data.date_from || "البداية"} → {data.date_to || "اليوم"}</>}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {(data.date_from || data.date_to) && <>
                                <div className="text-center"><div className="text-xs text-slate-500">إجمالي مدين (الفترة)</div><div className="text-lg font-bold tabular-nums">{fmt(data.period_debit)}</div></div>
                                <div className="text-center"><div className="text-xs text-slate-500">إجمالي دائن (الفترة)</div><div className="text-lg font-bold tabular-nums text-rose-700">{fmt(data.period_credit)}</div></div>
                            </>}
                            <div className="text-left"><div className="text-xs text-slate-500">الرصيد المستحق</div><div className={`text-2xl font-bold tabular-nums ${data.closing_balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(data.closing_balance)}</div></div>
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
                                    <td className="p-3 tabular-nums">{e.debit ? fmt(e.debit) : "—"}</td>
                                    <td className="p-3 tabular-nums text-rose-700">{e.credit ? fmt(e.credit) : "—"}</td>
                                    <td className="p-3 tabular-nums font-semibold">{fmt(e.balance)}</td>
                                </tr>
                            ))}
                            {data.entries.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد حركات</td></tr>}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
