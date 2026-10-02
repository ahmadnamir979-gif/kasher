import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import SearchSelect from "@/components/SearchSelect";

export default function Purchases() {
    const [items, setItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [open, setOpen] = useState(false);
    const [isReturn, setIsReturn] = useState(false);
    const [supplierId, setSupplierId] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [discount, setDiscount] = useState(0);
    const [extraCharges, setExtraCharges] = useState(0);
    const [paid, setPaid] = useState(0);
    const [notes, setNotes] = useState("");
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

    const resetForm = () => {
        setRows([]); setSupplierId(""); setDiscount(0); setExtraCharges(0);
        setPaid(0); setNotes(""); setPaymentMethod("cash"); setIsReturn(false);
    };

    const addRow = () => setRows(r => [...r, { product_id: "", name: "", qty: 1, price: 0, cost: 0, tax_rate: 0, discount: 0 }]);
    const setRow = (i, patch) => setRows(r => r.map((x, k) => k === i ? { ...x, ...patch } : x));
    const removeRow = (i) => setRows(r => r.filter((_, k) => k !== i));

    const submit = async () => {
        try {
            const its = rows.filter(r => r.product_id).map(r => ({ ...r, cost: r.cost || r.price, price: r.price }));
            if (its.length === 0) return toast.error("أضف صنف واحد على الأقل");
            const supplier = suppliers.find(s => s.id === supplierId);
            await api.post("/purchases", {
                supplier_id: supplierId || null,
                supplier_name: supplier?.name || "",
                warehouse_id: warehouseId || null,
                items: its, discount: +discount, extra_charges: +extraCharges,
                paid: +paid, payment_method: paymentMethod, notes,
                is_return: isReturn,
            });
            toast.success(isReturn ? "تم حفظ مرتجع المشتريات" : "تم حفظ فاتورة الشراء");
            setOpen(false); resetForm(); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const subtotal = rows.reduce((s, r) => s + (r.qty * r.price), 0);
    const taxTotal = rows.reduce((s, r) => s + (r.qty * r.price * (r.tax_rate || 0) / 100), 0);
    const total = subtotal + taxTotal - +discount + +extraCharges;

    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                <div><h3 className="font-semibold">فواتير المشتريات</h3><p className="text-xs text-slate-500">{items.length} فاتورة</p></div>
                <div className="flex gap-2">
                    <Dialog open={open && !isReturn} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); else setIsReturn(false); }}>
                        <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-purchase-btn"><Plus className="w-4 h-4" /> فاتورة شراء</Button></DialogTrigger>
                        <PurchaseDialog {...{isReturn: false, suppliers, warehouses, products, supplierId, setSupplierId, warehouseId, setWarehouseId, paymentMethod, setPaymentMethod, discount, setDiscount, extraCharges, setExtraCharges, paid, setPaid, notes, setNotes, rows, setRow, removeRow, addRow, submit, subtotal, taxTotal, total}} />
                    </Dialog>
                    <Dialog open={open && isReturn} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); else setIsReturn(true); }}>
                        <DialogTrigger asChild><Button variant="outline" className="gap-2 border-rose-400 text-rose-700" data-testid="add-return-btn"><Undo2 className="w-4 h-4" /> مرتجع مشتريات</Button></DialogTrigger>
                        <PurchaseDialog {...{isReturn: true, suppliers, warehouses, products, supplierId, setSupplierId, warehouseId, setWarehouseId, paymentMethod, setPaymentMethod, discount, setDiscount, extraCharges, setExtraCharges, paid, setPaid, notes, setNotes, rows, setRow, removeRow, addRow, submit, subtotal, taxTotal, total}} />
                    </Dialog>
                </div>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600">
                    <tr><th className="p-3">رقم</th><th className="p-3">التاريخ</th><th className="p-3">المورد</th><th className="p-3">الأصناف</th><th className="p-3">خصم</th><th className="p-3">مصاريف</th><th className="p-3">الإجمالي</th><th className="p-3">الدفع</th><th className="p-3">الحالة</th></tr>
                </thead>
                <tbody>
                    {items.map(p => (
                        <tr key={p.id} className="border-b border-zinc-100">
                            <td className="p-3 tabular-nums font-mono">#{p.invoice_no}</td>
                            <td className="p-3 tabular-nums text-slate-600">{p.created_at?.substring(0,16).replace("T"," ")}</td>
                            <td className="p-3">{p.supplier_name || "—"}</td>
                            <td className="p-3 tabular-nums">{p.items?.length}</td>
                            <td className="p-3 tabular-nums">{fmt(p.discount || 0)}</td>
                            <td className="p-3 tabular-nums">{fmt(p.extra_charges || 0)}</td>
                            <td className={`p-3 tabular-nums font-semibold ${p.is_return ? "text-rose-700" : ""}`}>{fmt(p.total)}</td>
                            <td className="p-3">{p.payment_method === "credit" ? <Badge className="bg-amber-100 text-amber-800">آجل</Badge> : <Badge className="bg-emerald-100 text-emerald-800">نقدي</Badge>}</td>
                            <td className="p-3">{p.is_return ? <Badge className="bg-rose-100 text-rose-800">مرتجع</Badge> : <Badge className="bg-slate-100">فاتورة</Badge>}</td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">لا توجد مشتريات بعد</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}

function PurchaseDialog(p) {
    return (
        <DialogContent dir="rtl" className="bg-white max-w-5xl">
            <DialogHeader><DialogTitle>{p.isReturn ? "مرتجع مشتريات جديد" : "فاتورة شراء جديدة"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <Label>المورد</Label>
                        <SearchSelect value={p.supplierId} onChange={p.setSupplierId}
                            options={p.suppliers.map(s => ({ value: s.id, label: s.name, hint: s.phone }))}
                            allowEmpty emptyLabel="— بدون مورد —" placeholder="ابحث عن المورد…" testid="supplier-select" className="mt-1" />
                    </div>
                    <div>
                        <Label>المخزن</Label>
                        <SearchSelect value={p.warehouseId} onChange={p.setWarehouseId}
                            options={p.warehouses.map(w => ({ value: w.id, label: w.name, hint: w.location }))}
                            placeholder="اختر المخزن…" testid="purchase-warehouse" className="mt-1" />
                    </div>
                    <div>
                        <Label>طريقة الدفع</Label>
                        <SearchSelect value={p.paymentMethod} onChange={p.setPaymentMethod}
                            options={[{value:"cash",label:"نقدي"},{value:"card",label:"بطاقة"},{value:"credit",label:"آجل"}]}
                            testid="payment-method" className="mt-1" />
                    </div>
                </div>
                <div className="border border-zinc-200 rounded-md">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-xs text-slate-600 text-right"><tr><th className="p-2">الصنف</th><th className="p-2">الكمية</th><th className="p-2">التكلفة</th><th className="p-2">ضريبة %</th><th className="p-2">الإجمالي</th><th></th></tr></thead>
                        <tbody>
                            {p.rows.map((r, i) => (
                                <tr key={i} className="border-t">
                                    <td className="p-2">
                                        <SearchSelect value={r.product_id}
                                            onChange={(v) => { const prod = p.products.find(x => x.id === v); p.setRow(i, { product_id: v, name: prod?.name || "", price: prod?.cost_price || 0, cost: prod?.cost_price || 0, tax_rate: prod?.tax_rate || 0 }); }}
                                            options={p.products.map(pr => ({ value: pr.id, label: pr.name, hint: pr.barcode }))}
                                            placeholder="ابحث عن صنف…" testid={`purchase-row-product-${i}`} />
                                    </td>
                                    <td className="p-2"><Input type="number" value={r.qty} onChange={(e) => p.setRow(i, { qty: +e.target.value })} className="h-9 w-24" /></td>
                                    <td className="p-2"><Input type="number" value={r.price} onChange={(e) => p.setRow(i, { price: +e.target.value, cost: +e.target.value })} className="h-9 w-28" /></td>
                                    <td className="p-2"><Input type="number" value={r.tax_rate} onChange={(e) => p.setRow(i, { tax_rate: +e.target.value })} className="h-9 w-20" /></td>
                                    <td className="p-2 tabular-nums font-semibold">{fmt(r.qty * r.price)}</td>
                                    <td className="p-2"><Button size="sm" variant="outline" onClick={() => p.removeRow(i)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Button variant="ghost" onClick={p.addRow} className="w-full gap-2" data-testid="add-purchase-row"><Plus className="w-4 h-4" /> إضافة سطر</Button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    <div><Label>خصم الفاتورة</Label><Input type="number" value={p.discount} onChange={(e) => p.setDiscount(+e.target.value)} data-testid="purchase-discount" /></div>
                    <div><Label>مصاريف إضافية</Label><Input type="number" value={p.extraCharges} onChange={(e) => p.setExtraCharges(+e.target.value)} data-testid="purchase-extra" /></div>
                    <div><Label>المدفوع الآن</Label><Input type="number" value={p.paid} onChange={(e) => p.setPaid(+e.target.value)} data-testid="purchase-paid" /></div>
                    <div><Label>ملاحظات</Label><Input value={p.notes} onChange={(e) => p.setNotes(e.target.value)} /></div>
                </div>
                <div className="flex items-center justify-between bg-zinc-50 p-4 rounded-md">
                    <div className="text-sm space-y-1">
                        <div>المجموع الفرعي: <span className="tabular-nums font-semibold">{fmt(p.subtotal)}</span></div>
                        <div>ضريبة: <span className="tabular-nums">{fmt(p.taxTotal)}</span></div>
                        <div>خصم: <span className="tabular-nums text-rose-700">-{fmt(p.discount)}</span></div>
                        <div>مصاريف: <span className="tabular-nums">+{fmt(p.extraCharges)}</span></div>
                    </div>
                    <div className="text-left text-2xl font-bold tabular-nums">الإجمالي: {fmt(p.total)}</div>
                </div>
            </div>
            <DialogFooter><Button onClick={p.submit} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-purchase-btn">{p.isReturn ? "حفظ المرتجع" : "حفظ الفاتورة"}</Button></DialogFooter>
        </DialogContent>
    );
}
