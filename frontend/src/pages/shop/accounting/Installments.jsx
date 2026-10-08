import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Calendar as Cal, Wallet, Search, Users } from "lucide-react";
import { toast } from "sonner";
import SearchSelect from "@/components/SearchSelect";

export default function Installments() {
    const [rows, setRows] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [payFor, setPayFor] = useState(null); // {plan_id, seq, amount}
    const [payAmount, setPayAmount] = useState(0);
    const emptyForm = {
        customer_id: "", total_amount: 0, down_payment: 0,
        installments_count: 12, first_due_date: new Date().toISOString().slice(0, 10),
        frequency: "monthly", notes: "",
    };
    const [form, setForm] = useState(emptyForm);

    const load = async () => {
        try {
            const [i, c] = await Promise.all([api.get("/installments"), api.get("/customers")]);
            setRows(i.data); setCustomers(c.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const customerOptions = useMemo(() => customers.map(c => ({
        value: c.id,
        label: c.name,
        hint: [c.phone, (c.balance || 0) > 0 ? `عليه ${fmt(c.balance)}` : null].filter(Boolean).join(" · "),
    })), [customers]);

    const openCreate = () => { setForm(emptyForm); setOpen(true); };

    const submit = async () => {
        if (!form.customer_id) return toast.error("اختر عميلاً من القائمة");
        if (+form.total_amount <= 0) return toast.error("أدخل إجمالي المبلغ");
        if (+form.down_payment >= +form.total_amount) return toast.error("الدفعة الأولى يجب أن تكون أقل من الإجمالي");
        if (+form.installments_count < 1) return toast.error("عدد الأقساط يجب أن يكون ١ على الأقل");
        try {
            await api.post("/installments", {
                customer_id: form.customer_id,
                customer_name: customers.find(c => c.id === form.customer_id)?.name || "",
                total_amount: Number(form.total_amount),
                down_payment: Number(form.down_payment),
                installments_count: Number(form.installments_count),
                first_due_date: form.first_due_date,
                frequency: form.frequency,
                notes: form.notes,
            });
            toast.success("تمّ إنشاء خطة التقسيط وتحديث رصيد العميل");
            setOpen(false); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const pay = async () => {
        try {
            await api.post(`/installments/${payFor.plan_id}/pay?seq=${payFor.seq}&amount=${Number(payAmount)}`);
            toast.success("تمّ تسجيل الدفعة"); setPayOpen(false); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف خطة التقسيط؟ سيتم عكس المبلغ المتبقي من رصيد العميل.")) return;
        try { await api.delete(`/installments/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const totalPaid = (plan) => (plan.schedule || []).reduce((s, r) => s + (r.paid || 0), 0);
    const remaining = (plan) => plan.total_amount - plan.down_payment - totalPaid(plan);

    const filtered = useMemo(() => {
        const t = search.trim().toLowerCase();
        if (!t) return rows;
        return rows.filter(p => (p.customer_name || "").toLowerCase().includes(t)
            || (p.customer_phone || "").includes(t));
    }, [rows, search]);

    const totalDue = useMemo(() => rows.reduce((s, p) => s + Math.max(0, remaining(p)), 0), [rows]);

    return (
        <div className="space-y-4" dir="rtl">
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-l from-amber-50 to-white border border-amber-200 rounded-lg p-4"><div className="text-xs text-amber-700 font-semibold mb-1">عدد خطط التقسيط</div><div className="tabular-nums text-2xl font-black text-amber-800">{rows.length}</div></div>
                <div className="bg-gradient-to-l from-rose-50 to-white border border-rose-200 rounded-lg p-4"><div className="text-xs text-rose-700 font-semibold mb-1">إجمالي الأقساط المتبقية</div><div className="tabular-nums text-2xl font-black text-rose-800">{fmt(totalDue)}</div></div>
                <div className="bg-gradient-to-l from-emerald-50 to-white border border-emerald-200 rounded-lg p-4"><div className="text-xs text-emerald-700 font-semibold mb-1">خطط مكتملة السداد</div><div className="tabular-nums text-2xl font-black text-emerald-800">{rows.filter(p => remaining(p) <= 0.01).length}</div></div>
            </div>

            <Card className="border-zinc-200">
                <div className="p-4 border-b flex items-center gap-3">
                    <Cal className="w-5 h-5 text-amber-600" />
                    <h3 className="font-semibold flex-1">التقسيط وجدولة الديون</h3>
                    <div className="relative w-72">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم العميل أو الهاتف…" className="pr-10 h-9 text-sm" data-testid="inst-search" />
                    </div>
                    <Button onClick={openCreate} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="inst-add-btn"><Plus className="w-4 h-4" />خطة جديدة</Button>
                </div>

                <div className="divide-y divide-zinc-100">
                    {filtered.map(p => (
                        <div key={p.id} data-testid={`inst-row-${p.id}`}>
                            <div className="p-4 flex items-center gap-4 bg-zinc-50/50">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" />{p.customer_name}</div>
                                    <div className="text-xs text-slate-500">{p.installments_count} قسط · {p.frequency === "monthly" ? "شهري" : "أسبوعي"}{p.customer_phone ? ` · ${p.customer_phone}` : ""}</div>
                                </div>
                                <div className="text-center"><div className="text-xs text-slate-500">الإجمالي</div><div className="tabular-nums font-bold">{fmt(p.total_amount)}</div></div>
                                <div className="text-center"><div className="text-xs text-slate-500">دفعة أولى</div><div className="tabular-nums">{fmt(p.down_payment)}</div></div>
                                <div className="text-center"><div className="text-xs text-slate-500">المسدَّد</div><div className="tabular-nums text-emerald-700">{fmt(totalPaid(p))}</div></div>
                                <div className="text-center"><div className="text-xs text-slate-500">المتبقي</div><div className="tabular-nums text-rose-700 font-bold">{fmt(remaining(p))}</div></div>
                                <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-white text-xs text-right text-slate-600"><tr><th className="p-2 pr-4">#</th><th className="p-2">تاريخ الاستحقاق</th><th className="p-2">المبلغ</th><th className="p-2">مسدَّد</th><th className="p-2">الحالة</th><th className="p-2"></th></tr></thead>
                                <tbody>
                                    {(p.schedule || []).map((r) => (
                                        <tr key={r.seq} className="border-t border-zinc-100">
                                            <td className="p-2 pr-4 font-mono text-slate-400">{r.seq}</td>
                                            <td className="p-2 tabular-nums">{r.due_date}</td>
                                            <td className="p-2 tabular-nums">{fmt(r.amount)}</td>
                                            <td className="p-2 tabular-nums text-emerald-700">{fmt(r.paid)}</td>
                                            <td className="p-2">{r.status === "paid" ? <Badge className="bg-emerald-100 text-emerald-800">مسدَّد</Badge> : r.status === "partial" ? <Badge className="bg-amber-100 text-amber-800">جزئي</Badge> : <Badge className="bg-slate-100 text-slate-700">معلّق</Badge>}</td>
                                            <td className="p-2">
                                                {r.status !== "paid" && (
                                                    <Button size="sm" variant="outline" onClick={() => { setPayFor({ plan_id: p.id, seq: r.seq }); setPayAmount(r.amount - r.paid); setPayOpen(true); }} className="gap-1 text-emerald-600" data-testid={`inst-pay-${p.id}-${r.seq}`}><Wallet className="w-3 h-3" />تسديد</Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    {filtered.length === 0 && <div className="p-10 text-center text-slate-400">{search ? "لا توجد نتائج" : "لا توجد خطط تقسيط — ابدأ بإنشاء خطة جديدة"}</div>}
                </div>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent dir="rtl" className="bg-white max-w-lg">
                    <DialogHeader><DialogTitle>خطة تقسيط جديدة</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>العميل *</Label>
                            <SearchSelect
                                value={form.customer_id}
                                onChange={(v) => setForm(f => ({ ...f, customer_id: v }))}
                                options={customerOptions}
                                placeholder="— اختر عميلاً من قائمة العملاء —"
                                testid="inst-cust-search"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">مربوط مع صفحة العملاء — أي عميل تضيفه هناك يظهر هنا تلقائياً.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>إجمالي المبلغ</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} data-testid="inst-total" className="tabular-nums" /></div>
                            <div><Label>الدفعة الأولى</Label><Input type="number" value={form.down_payment} onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))} className="tabular-nums" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>عدد الأقساط</Label><Input type="number" min="1" value={form.installments_count} onChange={e => setForm(f => ({ ...f, installments_count: e.target.value }))} data-testid="inst-count" className="tabular-nums" /></div>
                            <div><Label>تاريخ أول قسط</Label><Input type="date" value={form.first_due_date} onChange={e => setForm(f => ({ ...f, first_due_date: e.target.value }))} /></div>
                        </div>
                        <div>
                            <Label>التكرار</Label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                {[["monthly", "شهري"], ["weekly", "أسبوعي"]].map(([k, lbl]) => (
                                    <button key={k} type="button" onClick={() => setForm(f => ({ ...f, frequency: k }))}
                                        className={`h-10 rounded-md border text-sm font-semibold transition ${form.frequency === k ? "bg-amber-500 text-white border-amber-500" : "bg-white border-zinc-200 hover:bg-zinc-50"}`}>
                                        {lbl}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div><Label>ملاحظات</Label><Input placeholder="(اختياري)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                        {+form.total_amount > 0 && +form.down_payment >= 0 && +form.installments_count > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs space-y-1">
                                <div className="flex justify-between"><span>قيمة كل قسط:</span><strong className="tabular-nums">{fmt(((+form.total_amount - +form.down_payment) / Math.max(1, +form.installments_count)))}</strong></div>
                                <div className="flex justify-between"><span>سيُضاف لرصيد العميل:</span><strong className="tabular-nums text-rose-700">{fmt(+form.total_amount - +form.down_payment)}</strong></div>
                            </div>
                        )}
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="inst-save">حفظ الخطة</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogContent dir="rtl" className="bg-white max-w-sm">
                    <DialogHeader><DialogTitle>تسديد قسط</DialogTitle></DialogHeader>
                    <div><Label>المبلغ</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="inst-pay-amount" className="tabular-nums" /></div>
                    <DialogFooter><Button variant="outline" onClick={() => setPayOpen(false)}>إلغاء</Button><Button onClick={pay} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="inst-pay-save">تسديد</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
