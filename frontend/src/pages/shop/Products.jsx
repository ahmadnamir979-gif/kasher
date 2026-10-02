import { useEffect, useRef, useState } from "react";
import { api, formatApiError, fmt, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Tag, FileSpreadsheet, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import SearchSelect from "@/components/SearchSelect";

export default function Products() {
    const [items, setItems] = useState([]);
    const [cats, setCats] = useState([]);
    const [open, setOpen] = useState(false);
    const [catOpen, setCatOpen] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [q, setQ] = useState("");
    const fileRef = useRef(null);
    const [form, setForm] = useState({ name: "", barcode: "", category_id: "", warehouse_id: "", supplier_id: "", cost_price: 0, sale_price: 0, wholesale_price: 0, stock: 0, min_stock: 0, unit: "قطعة", tax_rate: 0, location: "", is_active: true });
    const [cat, setCat] = useState({ name: "", color: "#3b82f6" });
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    const load = async () => {
        setItems((await api.get("/products")).data);
        setCats((await api.get("/categories")).data);
        setWarehouses((await api.get("/warehouses")).data);
        setSuppliers((await api.get("/suppliers")).data);
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        try { await api.post("/products", { ...form, category_id: form.category_id || null, warehouse_id: form.warehouse_id || null, supplier_id: form.supplier_id || null }); toast.success("تم الحفظ"); setOpen(false); setForm({ name: "", barcode: "", category_id: "", warehouse_id: "", supplier_id: "", cost_price: 0, sale_price: 0, wholesale_price: 0, stock: 0, min_stock: 0, unit: "قطعة", tax_rate: 0, location: "", is_active: true }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const saveCat = async () => {
        try { await api.post("/categories", cat); toast.success("تمت إضافة الفئة"); setCatOpen(false); setCat({ name: "", color: "#3b82f6" }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const del = async (p) => { if (!window.confirm(`حذف ${p.name}؟`)) return; await api.delete(`/products/${p.id}`); load(); };

    const downloadTemplate = async () => {
        try {
            const res = await api.get("/products/template", { responseType: "blob" });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a"); a.href = url; a.download = "products_template.xlsx"; a.click();
            URL.revokeObjectURL(url);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const uploadExcel = async (file) => {
        if (!file) return;
        const fd = new FormData(); fd.append("file", file);
        try {
            const { data } = await api.post("/products/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
            setImportResult(data);
            toast.success(`تمّ استيراد ${data.imported} منتج`);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
        if (fileRef.current) fileRef.current.value = "";
    };

    const filtered = items.filter(p => !q || p.name.includes(q) || (p.barcode || "").includes(q));

    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between gap-3">
                <div className="flex-1"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث…" className="max-w-md" data-testid="products-search" /></div>
                <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => uploadExcel(e.target.files?.[0])} data-testid="excel-file-input" />
                    <Button variant="outline" onClick={downloadTemplate} className="gap-2" data-testid="download-template-btn"><Download className="w-4 h-4" /> قالب</Button>
                    <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50" data-testid="import-excel-btn"><FileSpreadsheet className="w-4 h-4" /> استيراد Excel</Button>
                    <Dialog open={catOpen} onOpenChange={setCatOpen}>
                        <DialogTrigger asChild><Button variant="outline" className="gap-2" data-testid="add-category-btn"><Tag className="w-4 h-4" /> فئة</Button></DialogTrigger>
                        <DialogContent dir="rtl" className="bg-white">
                            <DialogHeader><DialogTitle>إضافة فئة</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                                <div><Label>اسم الفئة</Label><Input value={cat.name} onChange={(e) => setCat(c => ({...c, name: e.target.value}))} data-testid="cat-name-input" /></div>
                                <div><Label>لون الفئة</Label><Input type="color" value={cat.color} onChange={(e) => setCat(c => ({...c, color: e.target.value}))} className="h-10 w-24" /></div>
                            </div>
                            <DialogFooter><Button onClick={saveCat} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-cat-btn">حفظ</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-product-btn"><Plus className="w-4 h-4" /> إضافة منتج</Button></DialogTrigger>
                        <DialogContent dir="rtl" className="bg-white max-w-2xl">
                            <DialogHeader><DialogTitle>منتج جديد</DialogTitle></DialogHeader>
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label>اسم المنتج</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} data-testid="prod-name" /></div>
                                <div><Label>الباركود</Label><Input value={form.barcode} onChange={(e) => setForm(f => ({...f, barcode: e.target.value}))} data-testid="prod-barcode" /></div>
                                <div><Label>الفئة</Label>
                                    <SearchSelect value={form.category_id} onChange={(v) => setForm(f => ({...f, category_id: v}))}
                                        options={cats.map(c => ({ value: c.id, label: c.name }))}
                                        allowEmpty emptyLabel="— بدون فئة —" placeholder="اختر الفئة…" testid="prod-category" className="mt-1" />
                                </div>
                                <div><Label>المخزن</Label>
                                    <SearchSelect value={form.warehouse_id} onChange={(v) => setForm(f => ({...f, warehouse_id: v}))}
                                        options={warehouses.map(w => ({ value: w.id, label: w.name, hint: w.location }))}
                                        allowEmpty emptyLabel="— الافتراضي —" placeholder="اختر المخزن…" testid="prod-warehouse" className="mt-1" />
                                </div>
                                <div><Label>وحدة</Label><Input value={form.unit} onChange={(e) => setForm(f => ({...f, unit: e.target.value}))} /></div>
                                <div><Label>سعر التكلفة</Label><Input type="number" value={form.cost_price} onChange={(e) => setForm(f => ({...f, cost_price: +e.target.value}))} data-testid="prod-cost" /></div>
                                <div><Label>سعر البيع</Label><Input type="number" value={form.sale_price} onChange={(e) => setForm(f => ({...f, sale_price: +e.target.value}))} data-testid="prod-price" /></div>
                                <div><Label>سعر الجملة</Label><Input type="number" value={form.wholesale_price} onChange={(e) => setForm(f => ({...f, wholesale_price: +e.target.value}))} data-testid="prod-wholesale" /></div>
                                <div><Label>المخزون الحالي</Label><Input type="number" value={form.stock} onChange={(e) => setForm(f => ({...f, stock: +e.target.value}))} data-testid="prod-stock" /></div>
                                <div><Label>الحد الأدنى</Label><Input type="number" value={form.min_stock} onChange={(e) => setForm(f => ({...f, min_stock: +e.target.value}))} /></div>
                                <div><Label>نسبة الضريبة %</Label><Input type="number" value={form.tax_rate} onChange={(e) => setForm(f => ({...f, tax_rate: +e.target.value}))} /></div>
                                <div><Label>المورّد الافتراضي</Label>
                                    <SearchSelect value={form.supplier_id} onChange={(v) => setForm(f => ({...f, supplier_id: v}))}
                                        options={suppliers.map(s => ({ value: s.id, label: s.name, hint: s.phone }))}
                                        allowEmpty emptyLabel="— بدون مورد —" placeholder="ابحث عن مورد…" testid="prod-supplier" className="mt-1" />
                                </div>
                                <div><Label>موقع الصنف</Label><Input placeholder="رف A3 / ممر 2…" value={form.location} onChange={(e) => setForm(f => ({...f, location: e.target.value}))} data-testid="prod-location" /></div>
                            </div>
                            <DialogFooter><Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-product-btn">حفظ المنتج</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            <div className="overflow-x-auto">
                {importResult && (
                    <div className="m-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm">
                        <div className="font-semibold text-emerald-900">تمّ استيراد {importResult.imported} منتج بنجاح</div>
                        {importResult.errors?.length > 0 && (
                            <ul className="mt-2 text-xs text-rose-700 list-disc pr-5">
                                {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        )}
                    </div>
                )}
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600">
                        <tr><th className="p-3">المنتج</th><th className="p-3">الباركود</th><th className="p-3">الفئة</th><th className="p-3">التكلفة</th><th className="p-3">السعر</th><th className="p-3">المخزون</th><th className="p-3"></th></tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => {
                            const c = cats.find(x => x.id === p.category_id);
                            return (
                                <tr key={p.id} className="border-b border-zinc-100" data-testid={`product-row-${p.id}`}>
                                    <td className="p-3 font-medium text-slate-900">{p.name}</td>
                                    <td className="p-3 tabular-nums text-slate-600">{p.barcode || "—"}</td>
                                    <td className="p-3">{c ? <Badge style={{ backgroundColor: c.color, color: "white" }}>{c.name}</Badge> : "—"}</td>
                                    <td className="p-3 tabular-nums">{fmt(p.cost_price)}</td>
                                    <td className="p-3 tabular-nums font-semibold">{fmt(p.sale_price)}</td>
                                    <td className="p-3 tabular-nums">{p.stock <= p.min_stock ? <span className="text-rose-600 font-semibold">{p.stock}</span> : p.stock}</td>
                                    <td className="p-3"><Button size="sm" variant="outline" onClick={() => del(p)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">لا توجد منتجات — اضغط "إضافة منتج"</td></tr>}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
