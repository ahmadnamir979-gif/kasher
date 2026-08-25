import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Calendar as Cal, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function Installments() {
    const [rows, setRows] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [open, setOpen] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [payFor, setPayFor] = useState(null); // {plan_id, seq, amount}
    const [payAmount, setPayAmount] = useState(0);
    const [form, setForm] = useState({
        customer_id: "", customer_name: "", total_amount: 0, down_payment: 0,
        installments_count: 12, first_due_date: new Date().toISOString().slice(0, 10), frequency: "monthly", notes: "",
    });

    const load = async () => {
        try {
            const [i, c] = await Promise.all([api.get("/installments"), api.get("/customers")]);
            setRows(i.data); setCustomers(c.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const submit = async () => {
        try {
            await api.post("/installments", {
                ...form,
                total_amount: Number(form.total_amount),
                down_payment: Number(form.down_payment),
                installments_count: Number(form.installments_count),
            });
            toast.success("تم إنشاء خطة التقسيط"); setOpen(false); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const pay = async () => {
        try {
            await api.post(`/installments/${payFor.plan_id}/pay?seq=${payFor.seq}&amount=${Number(payAmount)}`);
            toast.success("تم تسجيل الدفعة"); setPayOpen(false); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف خطة التقسيط؟")) return;
        try { await api.delete(`/installments/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const totalPaid = (plan) => plan.schedule.reduce((s, r) => s + (r.paid || 0), 0);
    const remaining = (plan) => plan.total_amount - plan.down_payment - totalPaid(plan);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Cal className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">التقسيط وجدولة الديون</h2>
                    <p className="text-sm text-slate-500">{rows.length} خطة تقسيط</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="inst-add-btn"><Plus className="w-4 h-4" />خطة جديدة</Button>
            </div>

            <div className="space-y-3">
                {rows.map(p => (
                    <Card key={p.id} className="border-zinc-200" data-testid={`inst-row-${p.id}`}>
                        <div className="p-4 flex items-center gap-4 border-b border-zinc-100">
                            <div className="flex-1">
                                <div className="font-semibold">{p.customer_name}</div>
                                <div className="text-xs text-slate-500">{p.installments_count} قسط • {p.frequency === "monthly" ? "شهري" : "أسبوعي"}</div>
                            </div>
                            <div className="text-center"><div className="text-xs text-slate-500">الإجمالي</div><div className="tabular-nums font-bold">{fmt(p.total_amount)}</div></div>
                            <div className="text-center"><div className="text-xs text-slate-500">دفعة أولى</div><div className="tabular-nums">{fmt(p.down_payment)}</div></div>
                            <div className="text-center"><div className="text-xs text-slate-500">المسدَّد</div><div className="tabular-nums text-emerald-700">{fmt(totalPaid(p))}</div></div>
                            <div className="text-center"><div className="text-xs text-slate-500">المتبقي</div><div className="tabular-nums text-rose-700">{fmt(remaining(p))}</div></div>
                            <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs text-right"><tr><th className="p-2">#</th><th className="p-2">تاريخ الاستحقاق</th><th className="p-2">المبلغ</th><th className="p-2">مسدَّد</th><th className="p-2">الحالة</th><th className="p-2"></th></tr></thead>
                            <tbody>
                                {p.schedule.map((r) => (
                                    <tr key={r.seq} className="border-t border-zinc-100">
                                        <td className="p-2 font-mono">{r.seq}</td>
                                        <td className="p-2 tabular-nums">{r.due_date}</td>
                                        <td className="p-2 tabular-nums">{fmt(r.amount)}</td>
                                        <td className="p-2 tabular-nums">{fmt(r.paid)}</td>
                                        <td className="p-2">{r.status === "paid" ? <Badge className="bg-emerald-100 text-emerald-800">مسدَّد</Badge> : r.status === "partial" ? <Badge className="bg-amber-100 text-amber-800">جزئي</Badge> : <Badge className="bg-slate-100">معلق</Badge>}</td>
                                        <td className="p-2">
                                            {r.status !== "paid" && (
                                                <Button size="sm" variant="outline" onClick={() => { setPayFor({ plan_id: p.id, seq: r.seq }); setPayAmount(r.amount - r.paid); setPayOpen(true); }} className="gap-1 text-emerald-600" data-testid={`inst-pay-${p.id}-${r.seq}`}><Wallet className="w-3 h-3" />تسديد</Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                ))}
                {rows.length === 0 && <Card className="p-8 text-center text-slate-400">لا توجد خطط تقسيط</Card>}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>خطة تقسيط جديدة</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Select value={form.customer_id} onValueChange={v => { const c = customers.find(x => x.id === v); setForm(f => ({ ...f, customer_id: v, customer_name: c?.name || "" })); }}>
                            <SelectTrigger data-testid="inst-cust"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                            <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs">إجمالي المبلغ</label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} data-testid="inst-total" /></div>
                            <div><label className="text-xs">الدفعة الأولى</label><Input type="number" value={form.down_payment} onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs">عدد الأقساط</label><Input type="number" min="1" value={form.installments_count} onChange={e => setForm(f => ({ ...f, installments_count: e.target.value }))} data-testid="inst-count" /></div>
                            <div><label className="text-xs">تاريخ أول قسط</label><Input type="date" value={form.first_due_date} onChange={e => setForm(f => ({ ...f, first_due_date: e.target.value }))} /></div>
                        </div>
                        <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="monthly">شهري</SelectItem><SelectItem value="weekly">أسبوعي</SelectItem></SelectContent>
                        </Select>
                        <Input placeholder="ملاحظات" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} data-testid="inst-save">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>تسديد قسط</DialogTitle></DialogHeader>
                    <div><label className="text-xs">المبلغ</label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="inst-pay-amount" /></div>
                    <DialogFooter><Button variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button><Button onClick={pay} className="bg-emerald-600 hover:bg-emerald-700" data-testid="inst-pay-save">تسديد</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
