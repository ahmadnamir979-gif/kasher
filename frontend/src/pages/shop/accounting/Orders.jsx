import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, ClipboardList, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_META = {
    open: { label: "مفتوح", color: "bg-amber-100 text-amber-800" },
    confirmed: { label: "مؤكد", color: "bg-blue-100 text-blue-800" },
    delivered: { label: "مسلَّم", color: "bg-emerald-100 text-emerald-800" },
    cancelled: { label: "ملغى", color: "bg-rose-100 text-rose-800" },
};

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [tab, setTab] = useState("sales_order");
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        kind: "sales_order", date: new Date().toISOString().slice(0, 10), party_id: "", party_name: "", items: [], notes: "",
    });
    const [pickProd, setPickProd] = useState("");
    const [pickQty, setPickQty] = useState(1);

    const load = async () => {
        try {
            const [o, p, c, s] = await Promise.all([
                api.get("/orders"), api.get("/products"), api.get("/customers"), api.get("/suppliers"),
            ]);
            setOrders(o.data); setProducts(p.data); setCustomers(c.data); setSuppliers(s.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const openNew = (kind) => {
        setForm({ kind, date: new Date().toISOString().slice(0, 10), party_id: "", party_name: "", items: [], notes: "" });
        setOpen(true);
    };

    const addItem = () => {
        const p = products.find(x => x.id === pickProd);
        if (!p || pickQty <= 0) return;
        setForm(f => ({
            ...f, items: [...f.items, { product_id: p.id, name: p.name, qty: Number(pickQty), price: p.price || 0 }],
        }));
        setPickProd(""); setPickQty(1);
    };

    const submit = async () => {
        try {
            await api.post("/orders", { ...form, party_id: form.party_id || null });
            toast.success("تم"); setOpen(false); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const setStatus = async (id, status) => {
        try { await api.patch(`/orders/${id}/status?status=${status}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف الطلبية؟")) return;
        try { await api.delete(`/orders/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const filtered = orders.filter(o => o.kind === tab);
    const parties = form.kind === "sales_order" ? customers : suppliers;
    const total = form.items.reduce((s, i) => s + i.qty * i.price, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <ClipboardList className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">الطلبيات</h2>
                    <p className="text-sm text-slate-500">طلبيات المبيعات (من العملاء) وطلبيات الشراء (للموردين)</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => openNew("sales_order")} className="bg-emerald-600 hover:bg-emerald-700 gap-1" data-testid="order-add-sales"><Plus className="w-4 h-4" />طلب مبيعات</Button>
                    <Button onClick={() => openNew("purchase_order")} className="bg-blue-600 hover:bg-blue-700 gap-1" data-testid="order-add-purchase"><Plus className="w-4 h-4" />طلب شراء</Button>
                </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                    <TabsTrigger value="sales_order" data-testid="tab-sales-orders">طلبيات المبيعات</TabsTrigger>
                    <TabsTrigger value="purchase_order" data-testid="tab-purchase-orders">طلبيات الشراء</TabsTrigger>
                </TabsList>
                {["sales_order", "purchase_order"].map(k => (
                    <TabsContent key={k} value={k}>
                        <Card className="overflow-x-auto border-zinc-200">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 border-b text-right text-xs"><tr><th className="p-3">#</th><th className="p-3">التاريخ</th><th className="p-3">الطرف</th><th className="p-3">أصناف</th><th className="p-3">الإجمالي</th><th className="p-3">الحالة</th><th className="p-3"></th></tr></thead>
                                <tbody>
                                    {filtered.map(o => (
                                        <tr key={o.id} className="border-b" data-testid={`order-row-${o.number}`}>
                                            <td className="p-3 font-mono">{o.number}</td>
                                            <td className="p-3">{o.date}</td>
                                            <td className="p-3">{o.party_name}</td>
                                            <td className="p-3 tabular-nums">{o.items?.length || 0}</td>
                                            <td className="p-3 tabular-nums font-semibold">{fmt(o.total)}</td>
                                            <td className="p-3"><Badge className={STATUS_META[o.status]?.color}>{STATUS_META[o.status]?.label}</Badge></td>
                                            <td className="p-3">
                                                <div className="flex gap-1">
                                                    {o.status === "open" && <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "confirmed")} data-testid={`order-confirm-${o.id}`}>تأكيد</Button>}
                                                    {o.status === "confirmed" && <Button size="sm" variant="outline" onClick={() => setStatus(o.id, "delivered")} className="text-emerald-600 gap-1" data-testid={`order-deliver-${o.id}`}><CheckCircle2 className="w-3 h-3" />تسليم</Button>}
                                                    <Button size="sm" variant="ghost" onClick={() => remove(o.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">لا توجد طلبيات</td></tr>}
                                </tbody>
                            </table>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>{form.kind === "sales_order" ? "طلب مبيعات" : "طلب شراء"} جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs">التاريخ</label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                            <div>
                                <label className="text-xs">{form.kind === "sales_order" ? "العميل" : "المورد"}</label>
                                <Select value={form.party_id} onValueChange={v => { const p = parties.find(x => x.id === v); setForm(f => ({ ...f, party_id: v, party_name: p?.name || "" })); }}>
                                    <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                                    <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="p-3 bg-zinc-50 rounded-lg border">
                            <div className="text-sm font-semibold mb-2">إضافة صنف</div>
                            <div className="flex gap-2">
                                <Select value={pickProd} onValueChange={setPickProd}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="اختر صنفاً..." /></SelectTrigger>
                                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" min="1" value={pickQty} onChange={e => setPickQty(e.target.value)} className="w-24" />
                                <Button onClick={addItem} className="gap-1"><Plus className="w-4 h-4" />إضافة</Button>
                            </div>
                        </div>
                        <table className="w-full text-sm border rounded">
                            <thead className="bg-zinc-50"><tr><th className="p-2">الصنف</th><th className="p-2 w-24">الكمية</th><th className="p-2 w-24">السعر</th><th className="p-2">المجموع</th><th></th></tr></thead>
                            <tbody>
                                {form.items.map((it, i) => (
                                    <tr key={i} className="border-t">
                                        <td className="p-2">{it.name}</td>
                                        <td className="p-2"><Input type="number" value={it.qty} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, idx) => idx === i ? { ...x, qty: Number(e.target.value) } : x) }))} /></td>
                                        <td className="p-2"><Input type="number" step="0.01" value={it.price} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, idx) => idx === i ? { ...x, price: Number(e.target.value) } : x) }))} /></td>
                                        <td className="p-2 tabular-nums">{fmt(it.qty * it.price)}</td>
                                        <td><Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}><X className="w-4 h-4" /></Button></td>
                                    </tr>
                                ))}
                                {form.items.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-slate-400">لا أصناف</td></tr>}
                            </tbody>
                            <tfoot className="bg-zinc-50 font-bold"><tr><td colSpan="3" className="p-2 text-left">الإجمالي</td><td colSpan="2" className="p-2 tabular-nums">{fmt(total)}</td></tr></tfoot>
                        </table>
                        <Input placeholder="ملاحظات" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} disabled={form.items.length === 0 || !form.party_name} data-testid="order-save">حفظ الطلبية</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
