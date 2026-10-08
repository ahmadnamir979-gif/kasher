import { useEffect, useState, useMemo } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Users, Phone, MapPin, FileText, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Customers() {
    const nav = useNavigate();
    const [items, setItems] = useState([]);
    const [q, setQ] = useState("");
    const [dlg, setDlg] = useState(null);
    const [payDlg, setPayDlg] = useState(null);
    const load = () => api.get("/customers").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);

    const empty = { name: "", phone: "", address: "", email: "", opening_balance: 0 };
    const openAdd = () => setDlg({ mode: "add", form: { ...empty } });
    const openEdit = (c) => setDlg({ mode: "edit", id: c.id, form: {
        name: c.name || "", phone: c.phone || "", address: c.address || "", email: c.email || ""
    } });

    const save = async () => {
        try {
            const f = dlg.form;
            if (!f.name.trim()) return toast.error("الاسم مطلوب");
            if (dlg.mode === "add") {
                await api.post("/customers", { ...f, opening_balance: +f.opening_balance || 0 });
                toast.success("تمّت إضافة العميل");
            } else {
                await api.patch(`/customers/${dlg.id}`, {
                    name: f.name.trim(), phone: f.phone.trim(),
                    address: f.address.trim(), email: f.email.trim()
                });
                toast.success("تمّ التحديث");
            }
            setDlg(null); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const del = async (c) => {
        if (!window.confirm(`حذف العميل ${c.name}؟`)) return;
        try { await api.delete(`/customers/${c.id}`); toast.success("تمّ الحذف"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        return !t ? items : items.filter(c => (c.name || "").toLowerCase().includes(t) || (c.phone || "").includes(t));
    }, [items, q]);
    const totalDebt = useMemo(() => items.reduce((s, c) => s + Math.max(0, c.balance || 0), 0), [items]);

    return (
        <>
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gradient-to-l from-cyan-50 to-white border border-cyan-200 rounded-lg p-4"><div className="text-xs text-cyan-700 font-semibold mb-1">إجمالي العملاء</div><div className="tabular-nums text-2xl font-black text-cyan-800">{items.length}</div></div>
                <div className="bg-gradient-to-l from-rose-50 to-white border border-rose-200 rounded-lg p-4"><div className="text-xs text-rose-700 font-semibold mb-1">إجمالي الديون المستحقّة</div><div className="tabular-nums text-2xl font-black text-rose-800">{fmt(totalDebt)}</div></div>
                <div className="bg-gradient-to-l from-emerald-50 to-white border border-emerald-200 rounded-lg p-4"><div className="text-xs text-emerald-700 font-semibold mb-1">عملاء بدون ديون</div><div className="tabular-nums text-2xl font-black text-emerald-800">{items.filter(c => (c.balance || 0) <= 0).length}</div></div>
            </div>

            <Card className="border-zinc-200">
                <div className="p-5 border-b border-zinc-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                        <Users className="w-5 h-5 text-cyan-600" />
                        <h3 className="font-semibold">العملاء</h3>
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الهاتف..." className="pr-10 h-9 bg-white text-sm" data-testid="cust-search" />
                        </div>
                    </div>
                    <Button onClick={openAdd} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-customer-btn"><Plus className="w-4 h-4" /> عميل جديد</Button>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                        <tr><th className="p-3">الاسم</th><th className="p-3">الهاتف</th><th className="p-3">العنوان</th><th className="p-3">الرصيد الافتتاحي</th><th className="p-3">الرصيد الحالي</th><th className="p-3 text-left">إجراءات</th></tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50" data-testid={`cust-row-${c.id}`}>
                                <td className="p-3 font-medium">{c.name}</td>
                                <td className="p-3 tabular-nums text-slate-700">{c.phone || "—"}</td>
                                <td className="p-3 text-slate-600 text-xs">{c.address || "—"}</td>
                                <td className="p-3 tabular-nums text-slate-500">{fmt(c.opening_balance || 0)}</td>
                                <td className={`p-3 tabular-nums font-bold ${(c.balance || 0) > 0 ? "text-rose-700" : (c.balance || 0) < 0 ? "text-emerald-700" : "text-slate-400"}`}>
                                    {fmt(Math.abs(c.balance || 0))}
                                    {(c.balance || 0) > 0 && <div className="text-[10px] font-normal text-rose-500">مدين — له علينا تحصيله</div>}
                                    {(c.balance || 0) < 0 && <div className="text-[10px] font-normal text-emerald-600">دائن — رصيد مُقدَّم للعميل</div>}
                                </td>
                                <td className="p-3">
                                    <div className="flex justify-end gap-1.5">
                                        {(c.balance || 0) > 0 && <Button size="sm" onClick={() => setPayDlg({ customer: c, amount: c.balance, method: "cash" })} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8" data-testid={`pay-cust-${c.id}`}><HandCoins className="w-3.5 h-3.5" /> سداد</Button>}
                                        <Button size="sm" variant="outline" onClick={() => nav(`/customer-statement`)} className="text-indigo-600" title="كشف حساب" data-testid={`stmt-${c.id}`}><FileText className="w-3.5 h-3.5" /></Button>
                                        <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="text-slate-700" title="تعديل" data-testid={`edit-cust-${c.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                                        <Button size="sm" variant="outline" onClick={() => del(c)} className="text-rose-600" title="حذف"><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">{q ? "لا نتائج" : "لا يوجد عملاء — ابدأ بإضافة عميل جديد"}</td></tr>}
                    </tbody>
                </table>
            </Card>

            <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-lg">
                    <DialogHeader><DialogTitle>{dlg?.mode === "edit" ? "تعديل بيانات العميل" : "عميل جديد"}</DialogTitle></DialogHeader>
                    {dlg && (
                        <div className="space-y-3">
                            <div><Label>الاسم *</Label><Input value={dlg.form.name} onChange={(e) => setDlg(d => ({...d, form: {...d.form, name: e.target.value}}))} data-testid="cust-name" autoFocus /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label>الهاتف</Label><Input value={dlg.form.phone} onChange={(e) => setDlg(d => ({...d, form: {...d.form, phone: e.target.value}}))} data-testid="cust-phone" className="tabular-nums" placeholder="970591234567" /></div>
                                <div><Label>البريد الإلكتروني</Label><Input type="email" value={dlg.form.email} onChange={(e) => setDlg(d => ({...d, form: {...d.form, email: e.target.value}}))} /></div>
                            </div>
                            <div><Label>العنوان</Label><Input value={dlg.form.address} onChange={(e) => setDlg(d => ({...d, form: {...d.form, address: e.target.value}}))} data-testid="cust-address" placeholder="المدينة، الحي، الشارع..." /></div>
                            {dlg.mode === "add" && (
                                <div><Label>الرصيد الافتتاحي (دين على العميل)</Label><Input type="number" value={dlg.form.opening_balance} onChange={(e) => setDlg(d => ({...d, form: {...d.form, opening_balance: e.target.value}}))} data-testid="cust-opening" className="tabular-nums" /><p className="text-[11px] text-slate-500 mt-1">موجب (+) = العميل مدين لنا. سالب (−) = عندنا رصيد له. اتركها 0 إذا لا يوجد.</p></div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDlg(null)}>إلغاء</Button>
                        <Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-cust-btn">{dlg?.mode === "edit" ? "حفظ التعديلات" : "حفظ العميل"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={!!payDlg} onOpenChange={(o) => !o && setPayDlg(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-md">
                    <DialogHeader><DialogTitle>تحصيل دفعة — {payDlg?.customer.name}</DialogTitle></DialogHeader>
                    {payDlg && (
                        <div className="space-y-3">
                            <div className="bg-rose-50 border border-rose-200 rounded p-3 text-sm"><span className="text-rose-700 font-semibold">الرصيد الحالي:</span> <span className="tabular-nums font-bold">{fmt(payDlg.customer.balance)}</span></div>
                            <div><Label>المبلغ المستلم</Label><Input type="number" value={payDlg.amount} onChange={(e) => setPayDlg(p => ({...p, amount: e.target.value}))} data-testid="pay-amount" className="tabular-nums" autoFocus /></div>
                            <div><Label>طريقة الدفع</Label>
                                <select value={payDlg.method} onChange={(e) => setPayDlg(p => ({...p, method: e.target.value}))} className="w-full h-10 border border-zinc-200 rounded-md px-3 bg-white mt-1">
                                    <option value="cash">نقدي</option><option value="card">بطاقة</option><option value="bank">بنك</option>
                                </select></div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPayDlg(null)}>إلغاء</Button>
                        <Button onClick={async () => {
                            try { await api.post(`/customers/${payDlg.customer.id}/payment`, { amount: +payDlg.amount, method: payDlg.method });
                                toast.success("تمّ تسجيل التحصيل"); setPayDlg(null); load();
                            } catch (e) { toast.error(formatApiError(e)); }
                        }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="save-pay-cust"><HandCoins className="w-4 h-4" /> حفظ التحصيل</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
