import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";

const TYPE_META = {
    receipt: { label: "سند قبض", color: "bg-emerald-100 text-emerald-800" },
    payment: { label: "سند صرف", color: "bg-rose-100 text-rose-800" },
    journal: { label: "سند قيد", color: "bg-purple-100 text-purple-800" },
};

export default function Vouchers() {
    const [rows, setRows] = useState([]);
    const [tab, setTab] = useState("receipt");
    const [open, setOpen] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [form, setForm] = useState({
        type: "receipt",
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        party_type: "customer",
        party_id: "",
        party_name: "",
        account_id: "",
        counter_account_id: "",
        method: "cash",
        reference: "",
        description: "",
        check_number: "",
        check_date: "",
        bank_name: "",
    });

    const load = async () => {
        try {
            const [v, a, c, s] = await Promise.all([
                api.get("/accounting/vouchers"),
                api.get("/accounting/accounts"),
                api.get("/customers"),
                api.get("/suppliers"),
            ]);
            setRows(v.data);
            setAccounts(a.data.filter(x => !x.is_group));
            setCustomers(c.data);
            setSuppliers(s.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const openFor = (type) => {
        setForm(f => ({ ...f, type, party_type: type === "payment" ? "supplier" : "customer" }));
        setOpen(true);
    };

    const submit = async () => {
        try {
            await api.post("/accounting/vouchers", {
                ...form,
                amount: Number(form.amount),
                counter_account_id: form.counter_account_id || null,
                party_id: form.party_id || null,
                check_date: form.check_date || null,
            });
            toast.success("تم إضافة السند");
            setOpen(false);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف السند؟ سيُعكس القيد المرتبط.")) return;
        try { await api.delete(`/accounting/vouchers/${id}`); toast.success("تم الحذف"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const filtered = rows.filter(r => r.type === tab);
    const cashAccounts = accounts.filter(a => a.is_cash || a.is_bank || a.type === "asset");
    const parties = form.party_type === "customer" ? customers : suppliers;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Receipt className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">السندات المالية</h2>
                    <p className="text-sm text-slate-500">سندات القبض والصرف والقيد — قيد يومية تلقائي لكل سند</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => openFor("receipt")} className="bg-emerald-600 hover:bg-emerald-700 gap-1" data-testid="voucher-add-receipt"><Plus className="w-4 h-4" />قبض</Button>
                    <Button onClick={() => openFor("payment")} className="bg-rose-600 hover:bg-rose-700 gap-1" data-testid="voucher-add-payment"><Plus className="w-4 h-4" />صرف</Button>
                    <Button onClick={() => openFor("journal")} className="bg-purple-600 hover:bg-purple-700 gap-1" data-testid="voucher-add-journal"><Plus className="w-4 h-4" />قيد</Button>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="receipt" data-testid="tab-receipt">سندات القبض</TabsTrigger>
                    <TabsTrigger value="payment" data-testid="tab-payment">سندات الصرف</TabsTrigger>
                    <TabsTrigger value="journal" data-testid="tab-journal">سندات القيد</TabsTrigger>
                </TabsList>
                {["receipt", "payment", "journal"].map(k => (
                    <TabsContent key={k} value={k}>
                        <Card className="overflow-x-auto border-zinc-200">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                                    <tr>
                                        <th className="p-3">#</th>
                                        <th className="p-3">التاريخ</th>
                                        <th className="p-3">الطرف</th>
                                        <th className="p-3">الحساب</th>
                                        <th className="p-3">طريقة الدفع</th>
                                        <th className="p-3">المبلغ</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(v => (
                                        <tr key={v.id} className="border-b border-zinc-100" data-testid={`voucher-row-${v.number}`}>
                                            <td className="p-3 tabular-nums font-mono">{v.number}</td>
                                            <td className="p-3 tabular-nums">{v.date}</td>
                                            <td className="p-3">{v.party_name}</td>
                                            <td className="p-3 text-slate-600">{v.account_name}</td>
                                            <td className="p-3"><Badge variant="outline">{v.method === "cash" ? "نقدي" : v.method === "bank" ? "بنك" : "شيك"}</Badge></td>
                                            <td className="p-3 tabular-nums font-semibold">{fmt(v.amount)}</td>
                                            <td className="p-3"><Button size="sm" variant="ghost" onClick={() => remove(v.id)} className="text-rose-600" data-testid={`voucher-delete-${v.number}`}><Trash2 className="w-4 h-4" /></Button></td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">لا توجد سندات</td></tr>}
                                </tbody>
                            </table>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{TYPE_META[form.type]?.label} جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-600">التاريخ</label>
                                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} data-testid="voucher-date" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-600">المبلغ</label>
                                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} data-testid="voucher-amount" />
                            </div>
                        </div>
                        {form.type !== "journal" && (
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={form.party_type} onValueChange={v => setForm(f => ({ ...f, party_type: v, party_id: "", party_name: "" }))}>
                                    <SelectTrigger data-testid="voucher-party-type"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="customer">عميل</SelectItem>
                                        <SelectItem value="supplier">مورد</SelectItem>
                                        <SelectItem value="employee">موظف</SelectItem>
                                        <SelectItem value="other">آخر</SelectItem>
                                    </SelectContent>
                                </Select>
                                {form.party_type === "customer" || form.party_type === "supplier" ? (
                                    <Select value={form.party_id} onValueChange={v => {
                                        const p = parties.find(x => x.id === v);
                                        setForm(f => ({ ...f, party_id: v, party_name: p?.name || "" }));
                                    }}>
                                        <SelectTrigger data-testid="voucher-party-select"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                        <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : (
                                    <Input placeholder="اسم الطرف" value={form.party_name} onChange={e => setForm(f => ({ ...f, party_name: e.target.value }))} data-testid="voucher-party-name" />
                                )}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-600">الحساب (صندوق/بنك)</label>
                                <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                                    <SelectTrigger data-testid="voucher-account"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                    <SelectContent>{cashAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            {form.type === "journal" && (
                                <div>
                                    <label className="text-xs text-slate-600">الحساب المقابل</label>
                                    <Select value={form.counter_account_id} onValueChange={v => setForm(f => ({ ...f, counter_account_id: v }))}>
                                        <SelectTrigger data-testid="voucher-counter"><SelectValue placeholder="اختر..." /></SelectTrigger>
                                        <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            {form.type !== "journal" && (
                                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                                    <SelectTrigger data-testid="voucher-method"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">نقدي</SelectItem>
                                        <SelectItem value="bank">تحويل بنكي</SelectItem>
                                        <SelectItem value="check">شيك</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        {form.method === "check" && form.type !== "journal" && (
                            <div className="grid grid-cols-3 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <Input placeholder="رقم الشيك" value={form.check_number} onChange={e => setForm(f => ({ ...f, check_number: e.target.value }))} data-testid="voucher-check-no" />
                                <Input type="date" value={form.check_date} onChange={e => setForm(f => ({ ...f, check_date: e.target.value }))} data-testid="voucher-check-date" />
                                <Input placeholder="اسم البنك" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} data-testid="voucher-check-bank" />
                            </div>
                        )}
                        <Input placeholder="وصف / بيان (اختياري)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} data-testid="voucher-desc" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                        <Button onClick={submit} data-testid="voucher-save-btn">حفظ السند</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
