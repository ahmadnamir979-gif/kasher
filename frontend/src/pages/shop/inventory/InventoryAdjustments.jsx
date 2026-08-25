import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";

const KIND_META = {
    damage: { label: "تلف", color: "bg-rose-100 text-rose-800" },
    loss: { label: "فقد", color: "bg-rose-100 text-rose-800" },
    count: { label: "جرد", color: "bg-blue-100 text-blue-800" },
    expiry_writeoff: { label: "شطب لانتهاء الصلاحية", color: "bg-amber-100 text-amber-800" },
    correction: { label: "تعديل", color: "bg-slate-100 text-slate-800" },
    opening: { label: "جرد أول المدة", color: "bg-purple-100 text-purple-800" },
};

export default function InventoryAdjustments() {
    const [rows, setRows] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ kind: "damage", warehouse_id: "", items: [], reason: "", notes: "" });
    const [pickProd, setPickProd] = useState("");
    const [pickDelta, setPickDelta] = useState(-1);

    const load = async () => {
        try {
            const [a, p, w] = await Promise.all([
                api.get("/inventory/adjustments"),
                api.get("/products"),
                api.get("/warehouses"),
            ]);
            setRows(a.data); setProducts(p.data); setWarehouses(w.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const addItem = () => {
        const p = products.find(x => x.id === pickProd);
        if (!p) return;
        setForm(f => ({ ...f, items: [...f.items, { product_id: p.id, name: p.name, delta: Number(pickDelta), notes: "" }] }));
        setPickProd(""); setPickDelta(-1);
    };

    const submit = async () => {
        try {
            await api.post("/inventory/adjustments", {
                ...form,
                warehouse_id: form.warehouse_id || null,
            });
            toast.success("تم إنشاء مستند التسوية");
            setOpen(false);
            setForm({ kind: "damage", warehouse_id: "", items: [], reason: "", notes: "" });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف المستند؟ سيتم عكس التأثير على المخزون.")) return;
        try { await api.delete(`/inventory/adjustments/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <ClipboardCheck className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">مستندات ضبط المخازن</h2>
                    <p className="text-sm text-slate-500">{rows.length} مستند — تلف/فقد/جرد/شطب لانتهاء الصلاحية/تعديل</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="adj-add-btn"><Plus className="w-4 h-4" />مستند جديد</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs">
                        <tr>
                            <th className="p-3">#</th><th className="p-3">النوع</th><th className="p-3">أصناف</th><th className="p-3">السبب</th><th className="p-3">تأثير التكلفة</th><th className="p-3">التاريخ</th><th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-zinc-100" data-testid={`adj-row-${r.number}`}>
                                <td className="p-3 font-mono">{r.number}</td>
                                <td className="p-3"><Badge className={KIND_META[r.kind]?.color}>{KIND_META[r.kind]?.label}</Badge></td>
                                <td className="p-3 tabular-nums">{r.items?.length || 0}</td>
                                <td className="p-3 text-slate-600">{r.reason || "-"}</td>
                                <td className={`p-3 tabular-nums font-semibold ${r.cost_impact < 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(r.cost_impact)}</td>
                                <td className="p-3 tabular-nums text-xs">{r.created_at?.slice(0, 16).replace("T", " ")}</td>
                                <td className="p-3"><Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-slate-400">لا توجد مستندات</td></tr>}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>مستند ضبط جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v }))}>
                                <SelectTrigger data-testid="adj-kind"><SelectValue /></SelectTrigger>
                                <SelectContent>{Object.entries(KIND_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <Select value={form.warehouse_id} onValueChange={v => setForm(f => ({ ...f, warehouse_id: v }))}>
                                <SelectTrigger data-testid="adj-wh"><SelectValue placeholder="المخزن (اختياري)" /></SelectTrigger>
                                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <Input placeholder="السبب" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} data-testid="adj-reason" />
                        <div className="p-3 bg-zinc-50 rounded-lg border">
                            <div className="text-sm font-semibold mb-2">إضافة صنف</div>
                            <div className="flex gap-2">
                                <Select value={pickProd} onValueChange={setPickProd}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="اختر صنفاً..." /></SelectTrigger>
                                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (رصيد: {p.stock})</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" step="1" value={pickDelta} onChange={e => setPickDelta(e.target.value)} className="w-32" placeholder="+/-" data-testid="adj-pick-delta" />
                                <Button onClick={addItem} className="gap-1"><Plus className="w-4 h-4" /></Button>
                            </div>
                            <div className="text-xs text-slate-500 mt-2">
                                {form.kind === "opening" ? "للجرد الافتتاحي: أدخل الرصيد الفعلي (لا الفرق)" : "أدخل الفرق: قيمة سالبة للنقص، موجبة للزيادة"}
                            </div>
                        </div>
                        <table className="w-full text-sm border rounded">
                            <thead className="bg-zinc-50 text-xs"><tr><th className="p-2">الصنف</th><th className="p-2">التغيير</th><th className="p-2">ملاحظات</th><th></th></tr></thead>
                            <tbody>
                                {form.items.map((it, i) => (
                                    <tr key={i} className="border-t">
                                        <td className="p-2">{it.name}</td>
                                        <td className={`p-2 tabular-nums font-semibold ${it.delta < 0 ? "text-rose-700" : "text-emerald-700"}`}>{it.delta > 0 ? "+" : ""}{it.delta}</td>
                                        <td className="p-2"><Input value={it.notes} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x) }))} /></td>
                                        <td><Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}><X className="w-4 h-4" /></Button></td>
                                    </tr>
                                ))}
                                {form.items.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-slate-400">لا أصناف</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} disabled={form.items.length === 0} data-testid="adj-save">حفظ المستند</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
