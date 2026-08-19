import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Purchases() {
    const [items, setItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [open, setOpen] = useState(false);
    const [supplierId, setSupplierId] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [rows, setRows] = useState([]);

    const load = async () => {
        setItems((await api.get("/purchases")).data);
        setProducts((await api.get("/products")).data);
        setSuppliers((await api.get("/suppliers")).data);
        const w = (await api.get("/warehouses")).data;
        setWarehouses(w);
        const def = w.find(x => x.is_default) || w[0];
        if (def && !warehouseId) setWarehouseId(def.id);
    };
    useEffect(() => { load(); }, []);

    const addRow = () => setRows(r => [...r, { product_id: "", name: "", qty: 1, price: 0, cost: 0, tax_rate: 0, discount: 0 }]);
    const setRow = (i, patch) => setRows(r => r.map((x, k) => k === i ? { ...x, ...patch } : x));
    const removeRow = (i) => setRows(r => r.filter((_, k) => k !== i));

    const submit = async () => {
        try {
            const items = rows.filter(r => r.product_id).map(r => ({ ...r, cost: r.cost || r.price, price: r.price }));
            if (items.length === 0) return toast.error("أضف صنف واحد على الأقل");
            const supplier = suppliers.find(s => s.id === supplierId);
            await api.post("/purchases", { supplier_id: supplierId || null, supplier_name: supplier?.name || "", warehouse_id: warehouseId || null, items, discount: 0, paid: 0, is_return: false });
            toast.success("تم حفظ فاتورة الشراء");
            setOpen(false); setRows([]); setSupplierId(""); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const total = rows.reduce((s, r) => s + (r.qty * r.price), 0);

    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                <div><h3 className="font-semibold">فواتير المشتريات</h3><p className="text-xs text-slate-500">{items.length} فاتورة</p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-purchase-btn"><Plus className="w-4 h-4" /> فاتورة شراء</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="bg-white max-w-4xl">
                        <DialogHeader><DialogTitle>فاتورة شراء جديدة</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>المورد</Label>
                                    <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full h-10 border border-zinc-200 rounded-md px-3 mt-1 bg-white" data-testid="supplier-select">
                                        <option value="">— اختر مورد —</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label>المخزن (استلام إليه)</Label>
                                    <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full h-10 border border-zinc-200 rounded-md px-3 mt-1 bg-white" data-testid="purchase-warehouse-select">
                                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="border border-zinc-200 rounded-md">
                                <table className="w-full text-sm">
                                    <thead className="bg-zinc-50 text-xs text-slate-600 text-right"><tr><th className="p-2">الصنف</th><th className="p-2">الكمية</th><th className="p-2">التكلفة</th><th className="p-2">الإجمالي</th><th></th></tr></thead>
                                    <tbody>
                                        {rows.map((r, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="p-2">
                                                    <select value={r.product_id} onChange={(e) => { const p = products.find(x => x.id === e.target.value); setRow(i, { product_id: e.target.value, name: p?.name || "", price: p?.cost_price || 0, cost: p?.cost_price || 0 }); }}
                                                        className="w-full h-9 border border-zinc-200 rounded px-2 bg-white">
                                                        <option value="">اختر…</option>
                                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2"><Input type="number" value={r.qty} onChange={(e) => setRow(i, { qty: +e.target.value })} className="h-9" /></td>
                                                <td className="p-2"><Input type="number" value={r.price} onChange={(e) => setRow(i, { price: +e.target.value, cost: +e.target.value })} className="h-9" /></td>
                                                <td className="p-2 tabular-nums font-semibold">{fmt(r.qty * r.price)}</td>
                                                <td className="p-2"><Button size="sm" variant="outline" onClick={() => removeRow(i)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Button variant="ghost" onClick={addRow} className="w-full gap-2" data-testid="add-purchase-row"><Plus className="w-4 h-4" /> إضافة سطر</Button>
                            </div>
                            <div className="text-left text-lg font-bold tabular-nums">الإجمالي: {fmt(total)}</div>
                        </div>
                        <DialogFooter><Button onClick={submit} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-purchase-btn">حفظ الفاتورة</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600">
                    <tr><th className="p-3">رقم</th><th className="p-3">التاريخ</th><th className="p-3">المورد</th><th className="p-3">الأصناف</th><th className="p-3">الإجمالي</th></tr>
                </thead>
                <tbody>
                    {items.map(p => (
                        <tr key={p.id} className="border-b border-zinc-100">
                            <td className="p-3 tabular-nums font-mono">#{p.invoice_no}</td>
                            <td className="p-3 tabular-nums text-slate-600">{p.created_at?.substring(0,16).replace("T"," ")}</td>
                            <td className="p-3">{p.supplier_name || "—"}</td>
                            <td className="p-3 tabular-nums">{p.items?.length}</td>
                            <td className="p-3 tabular-nums font-semibold">{fmt(p.total)}</td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد مشتريات بعد</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}
