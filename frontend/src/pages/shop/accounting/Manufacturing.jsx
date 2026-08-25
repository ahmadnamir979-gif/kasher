import { useEffect, useState } from "react";
import { api, formatApiError, fmt, fmtInt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Factory, Play, X } from "lucide-react";
import { toast } from "sonner";

export default function Manufacturing() {
    const [formulas, setFormulas] = useState([]);
    const [products, setProducts] = useState([]);
    const [productions, setProductions] = useState([]);
    const [open, setOpen] = useState(false);
    const [prodOpen, setProdOpen] = useState(false);
    const [prodFor, setProdFor] = useState(null);
    const [batches, setBatches] = useState(1);
    const [form, setForm] = useState({ product_id: "", product_name: "", output_qty: 1, materials: [], labor_cost: 0, overhead_cost: 0 });
    const [pickProd, setPickProd] = useState("");
    const [pickQty, setPickQty] = useState(1);

    const load = async () => {
        try {
            const [f, p, r] = await Promise.all([
                api.get("/manufacturing/formulas"), api.get("/products"), api.get("/manufacturing/productions"),
            ]);
            setFormulas(f.data); setProducts(p.data); setProductions(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const addMat = () => {
        const p = products.find(x => x.id === pickProd);
        if (!p || pickQty <= 0) return;
        setForm(f => ({ ...f, materials: [...f.materials, { product_id: p.id, name: p.name, qty: Number(pickQty) }] }));
        setPickProd(""); setPickQty(1);
    };

    const submit = async () => {
        try {
            await api.post("/manufacturing/formulas", {
                ...form,
                output_qty: Number(form.output_qty),
                labor_cost: Number(form.labor_cost),
                overhead_cost: Number(form.overhead_cost),
            });
            toast.success("تم"); setOpen(false);
            setForm({ product_id: "", product_name: "", output_qty: 1, materials: [], labor_cost: 0, overhead_cost: 0 });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const produce = async () => {
        try {
            const r = await api.post("/manufacturing/produce", { formula_id: prodFor.id, batches: Number(batches) });
            toast.success(`تم إنتاج ${fmtInt(r.data.output_qty)} — بتكلفة ${fmt(r.data.total_cost)}`);
            setProdOpen(false); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف الوصفة؟")) return;
        try { await api.delete(`/manufacturing/formulas/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Factory className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">الأصناف المُنتجة والوصفات</h2>
                    <p className="text-sm text-slate-500">{formulas.length} وصفة تصنيع • {productions.length} عملية إنتاج</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="mfg-add-btn"><Plus className="w-4 h-4" />وصفة جديدة</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs"><tr><th className="p-3">المنتج النهائي</th><th className="p-3">كمية الإنتاج</th><th className="p-3">المواد</th><th className="p-3">تكلفة عمالة</th><th className="p-3">تكلفة إضافية</th><th className="p-3"></th></tr></thead>
                    <tbody>
                        {formulas.map(f => (
                            <tr key={f.id} className="border-b" data-testid={`mfg-row-${f.id}`}>
                                <td className="p-3 font-semibold">{f.product_name}</td>
                                <td className="p-3 tabular-nums">{fmtInt(f.output_qty)}</td>
                                <td className="p-3 text-xs text-slate-600">{f.materials.map(m => `${m.name} × ${m.qty}`).join(" + ")}</td>
                                <td className="p-3 tabular-nums">{fmt(f.labor_cost)}</td>
                                <td className="p-3 tabular-nums">{fmt(f.overhead_cost)}</td>
                                <td className="p-3">
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="outline" onClick={() => { setProdFor(f); setBatches(1); setProdOpen(true); }} className="gap-1 text-emerald-600" data-testid={`mfg-produce-${f.id}`}><Play className="w-3 h-3" />إنتاج</Button>
                                        <Button size="sm" variant="ghost" onClick={() => remove(f.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {formulas.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400">لا توجد وصفات</td></tr>}
                    </tbody>
                </table>
            </Card>

            {productions.length > 0 && (
                <Card className="border-zinc-200">
                    <div className="p-4 border-b"><h3 className="font-semibold">آخر عمليات الإنتاج</h3></div>
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-xs"><tr><th className="p-2">التاريخ</th><th className="p-2">الدفعات</th><th className="p-2">الإنتاج</th><th className="p-2">التكلفة الإجمالية</th><th className="p-2">تكلفة الوحدة</th></tr></thead>
                        <tbody>
                            {productions.slice(0, 20).map(p => (
                                <tr key={p.id} className="border-t border-zinc-100">
                                    <td className="p-2 tabular-nums text-xs">{p.created_at?.slice(0, 16).replace("T", " ")}</td>
                                    <td className="p-2 tabular-nums">{fmtInt(p.batches)}</td>
                                    <td className="p-2 tabular-nums">{fmtInt(p.output_qty)}</td>
                                    <td className="p-2 tabular-nums">{fmt(p.total_cost)}</td>
                                    <td className="p-2 tabular-nums">{fmt(p.unit_cost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>وصفة تصنيع جديدة</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs">المنتج النهائي</label>
                            <Select value={form.product_id} onValueChange={v => { const p = products.find(x => x.id === v); setForm(f => ({ ...f, product_id: v, product_name: p?.name || "" })); }}>
                                <SelectTrigger data-testid="mfg-output-product"><SelectValue placeholder="اختر منتجاً..." /></SelectTrigger>
                                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-xs">كمية الإنتاج</label><Input type="number" step="0.01" value={form.output_qty} onChange={e => setForm(f => ({ ...f, output_qty: e.target.value }))} /></div>
                            <div><label className="text-xs">تكلفة العمالة</label><Input type="number" step="0.01" value={form.labor_cost} onChange={e => setForm(f => ({ ...f, labor_cost: e.target.value }))} /></div>
                            <div><label className="text-xs">تكلفة إضافية</label><Input type="number" step="0.01" value={form.overhead_cost} onChange={e => setForm(f => ({ ...f, overhead_cost: e.target.value }))} /></div>
                        </div>
                        <div className="p-3 bg-zinc-50 rounded-lg border">
                            <div className="text-sm font-semibold mb-2">إضافة مادة خام</div>
                            <div className="flex gap-2">
                                <Select value={pickProd} onValueChange={setPickProd}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="اختر مادة..." /></SelectTrigger>
                                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" step="0.01" min="0" value={pickQty} onChange={e => setPickQty(e.target.value)} className="w-24" />
                                <Button onClick={addMat}><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>
                        <table className="w-full text-sm border rounded">
                            <thead className="bg-zinc-50 text-xs"><tr><th className="p-2">المادة</th><th className="p-2">الكمية</th><th></th></tr></thead>
                            <tbody>
                                {form.materials.map((m, i) => (
                                    <tr key={i} className="border-t">
                                        <td className="p-2">{m.name}</td>
                                        <td className="p-2 tabular-nums">{m.qty}</td>
                                        <td><Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, materials: f.materials.filter((_, idx) => idx !== i) }))}><X className="w-4 h-4" /></Button></td>
                                    </tr>
                                ))}
                                {form.materials.length === 0 && <tr><td colSpan="3" className="p-4 text-center text-slate-400">لا مواد</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} disabled={!form.product_id || form.materials.length === 0} data-testid="mfg-save">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={prodOpen} onOpenChange={setProdOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>إنتاج {prodFor?.product_name}</DialogTitle></DialogHeader>
                    <div>
                        <label className="text-xs">عدد الدفعات</label>
                        <Input type="number" step="0.01" min="0.01" value={batches} onChange={e => setBatches(e.target.value)} data-testid="mfg-batches" />
                        <div className="text-xs text-slate-500 mt-2">سيُنتج {fmtInt((prodFor?.output_qty || 0) * Number(batches))} وحدة</div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setProdOpen(false)}>إلغاء</Button><Button onClick={produce} className="bg-emerald-600 hover:bg-emerald-700" data-testid="mfg-produce-save">تنفيذ الإنتاج</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
