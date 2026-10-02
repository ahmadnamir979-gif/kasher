import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";

export default function CustomerStatement() {
    const [customers, setCustomers] = useState([]);
    const [selected, setSelected] = useState("");
    const [data, setData] = useState(null);
    const [payOpen, setPayOpen] = useState(false);
    const [amount, setAmount] = useState(0);
    const [method, setMethod] = useState("cash");

    useEffect(() => { api.get("/customers").then(r => setCustomers(r.data)); }, []);
    const loadStatement = async (cid) => {
        if (!cid) return setData(null);
        try { const r = await api.get(`/customers/${cid}/statement`); setData(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { loadStatement(selected); }, [selected]);

    const collect = async () => {
        try { await api.post(`/customers/${selected}/payment`, { amount: +amount, method });
            toast.success("تم التحصيل"); setPayOpen(false); setAmount(0); loadStatement(selected);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <Card className="p-4">
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <Label>اختر العميل</Label>
                        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full h-10 border border-zinc-200 rounded-md px-3 bg-white mt-1" data-testid="cust-select">
                            <option value="">—</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name} — رصيد: {fmt(c.balance || 0)}</option>)}
                        </select>
                    </div>
                    {selected && (
                        <Dialog open={payOpen} onOpenChange={setPayOpen}>
                            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="collect-btn"><HandCoins className="w-4 h-4" /> تحصيل مبلغ</Button></DialogTrigger>
                            <DialogContent dir="rtl" className="bg-white">
                                <DialogHeader><DialogTitle>تحصيل مبلغ من العميل</DialogTitle></DialogHeader>
                                <div className="space-y-3">
                                    <div><Label>المبلغ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="collect-amount" /></div>
                                    <div><Label>طريقة التحصيل</Label>
                                        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full h-10 border border-zinc-200 rounded-md px-3 bg-white mt-1">
                                            <option value="cash">نقدي</option><option value="card">بطاقة</option><option value="bank">بنك</option>
                                        </select></div>
                                </div>
                                <DialogFooter><Button onClick={collect} className="bg-slate-900 text-white" data-testid="save-collect">حفظ التحصيل</Button></DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </Card>
            {data && (
                <Card className="border-zinc-200">
                    <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                        <div><h3 className="font-semibold">كشف حساب — {data.customer.name}</h3><p className="text-xs text-slate-500">{data.customer.phone || ""}</p></div>
                        <div className="text-left"><div className="text-xs text-slate-500">الرصيد الحالي</div><div className={`text-2xl font-bold tabular-nums ${data.closing_balance > 0 ? "text-rose-700" : data.closing_balance < 0 ? "text-emerald-700" : ""}`}>{fmt(data.closing_balance)}</div></div>
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
                            {data.entries.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد حركات</td></tr>}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
