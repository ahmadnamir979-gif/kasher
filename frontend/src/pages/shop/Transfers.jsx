import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeftRight, Printer, Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import SearchSelect from "@/components/SearchSelect";

export default function Transfers() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [products, setProducts] = useState([]);
    const [open, setOpen] = useState(false);
    const [preview, setPreview] = useState(null);
    const [form, setForm] = useState({ from_warehouse_id: "", to_warehouse_id: "", notes: "", rows: [] });

    const load = async () => {
        setItems((await api.get("/transfers")).data);
        setWarehouses((await api.get("/warehouses")).data);
        setProducts((await api.get("/products")).data);
    };
    useEffect(() => { load(); }, []);

    const sourceProducts = products.filter(p => p.warehouse_id === form.from_warehouse_id);

    const addRow = () => setForm(f => ({ ...f, rows: [...f.rows, { product_id: "", qty: 1 }] }));
    const setRow = (i, patch) => setForm(f => ({ ...f, rows: f.rows.map((r, k) => k === i ? { ...r, ...patch } : r) }));
    const removeRow = (i) => setForm(f => ({ ...f, rows: f.rows.filter((_, k) => k !== i) }));

    const submit = async () => {
        try {
            const items = form.rows.filter(r => r.product_id && r.qty > 0).map(r => {
                const p = products.find(x => x.id === r.product_id);
                return { product_id: r.product_id, name: p?.name || "", qty: r.qty };
            });
            if (items.length === 0) return toast.error("أضف صنفاً واحداً على الأقل");
            const { data } = await api.post("/transfers", {
                from_warehouse_id: form.from_warehouse_id,
                to_warehouse_id: form.to_warehouse_id,
                items, notes: form.notes,
            });
            toast.success(`تمّ إنشاء إذن التحويل #${data.transfer_no}`);
            setOpen(false); setPreview(data); setForm({ from_warehouse_id: "", to_warehouse_id: "", notes: "", rows: [] });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const printVoucher = (t) => {
        const w = window.open("", "PRINT", "width=800,height=1000");
        const now = new Date().toLocaleString("en-GB");
        const rows = t.items.map((it, i) => `<tr><td>${i+1}</td><td>${it.name}</td><td>${it.qty}</td></tr>`).join("");
        w.document.write(`<html dir="rtl"><head><title>Transfer #${t.transfer_no}</title>
            <style>
                @page { size: A4; margin: 15mm; }
                body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; color: #000; }
                h1 { text-align: center; margin: 0 0 4px; font-size: 22px; }
                .sub { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
                .box { border: 2px solid #000; padding: 8px 12px; margin-bottom: 16px; display: flex; justify-content: space-between; font-size: 13px; }
                .box > div { display: flex; gap: 8px; }
                .box b { font-weight: 700; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 1px solid #333; padding: 6px 10px; text-align: right; }
                th { background: #f0f0f0; }
                .sig { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
                .sig > div { border-top: 1px solid #333; padding-top: 4px; min-width: 180px; text-align: center; }
            </style></head><body>
            <h1>${user?.shop?.name || ""}</h1>
            <div class="sub">إذن تحويل مخزني</div>
            <div class="box">
                <div><b>رقم الإذن:</b> #${t.transfer_no}</div>
                <div><b>التاريخ:</b> ${now}</div>
            </div>
            <div class="box">
                <div><b>من مخزن:</b> ${t.from_warehouse_name}</div>
                <div><b>إلى مخزن:</b> ${t.to_warehouse_name}</div>
            </div>
            <table><thead><tr><th style="width:40px">#</th><th>اسم الصنف</th><th style="width:80px">الكمية</th></tr></thead>
                <tbody>${rows}</tbody></table>
            ${t.notes ? `<div style="margin-top:16px;font-size:12px;"><b>ملاحظات:</b> ${t.notes}</div>` : ""}
            <div class="sig">
                <div>موظف المخزن المصدر</div>
                <div>موظف المخزن الوجهة</div>
                <div>${t.user_name || "المسؤول"}</div>
            </div>
            </body></html>`);
        w.document.close(); w.focus();
        setTimeout(() => { w.print(); w.close(); }, 400);
    };

    return (
        <div className="space-y-4">
            <Card className="border-zinc-200">
                <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                    <div><h3 className="font-semibold">تحويلات المخزون</h3><p className="text-xs text-slate-500">{items.length} إذن تحويل</p></div>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-transfer-btn"><Plus className="w-4 h-4" /> إذن تحويل جديد</Button></DialogTrigger>
                        <DialogContent dir="rtl" className="bg-white max-w-3xl">
                            <DialogHeader><DialogTitle>إذن تحويل مخزون</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>من مخزن</Label>
                                        <SearchSelect value={form.from_warehouse_id} onChange={(v) => setForm(f => ({...f, from_warehouse_id: v, rows: []}))}
                                            options={warehouses.map(w => ({ value: w.id, label: w.name, hint: w.location }))}
                                            placeholder="اختر مخزن المصدر…" testid="transfer-from" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label>إلى مخزن</Label>
                                        <SearchSelect value={form.to_warehouse_id} onChange={(v) => setForm(f => ({...f, to_warehouse_id: v}))}
                                            options={warehouses.filter(w => w.id !== form.from_warehouse_id).map(w => ({ value: w.id, label: w.name, hint: w.location }))}
                                            placeholder="اختر مخزن الوجهة…" testid="transfer-to" className="mt-1" />
                                    </div>
                                </div>
                                <div className="border border-zinc-200 rounded-md">
                                    <table className="w-full text-sm">
                                        <thead className="bg-zinc-50 text-xs text-slate-600 text-right"><tr><th className="p-2">الصنف</th><th className="p-2 w-24">الكمية</th><th className="p-2 w-24">متوفر</th><th></th></tr></thead>
                                        <tbody>
                                            {form.rows.map((r, i) => {
                                                const p = products.find(x => x.id === r.product_id);
                                                return (
                                                    <tr key={i} className="border-t">
                                                        <td className="p-2">
                                                            <SearchSelect value={r.product_id} onChange={(v) => setRow(i, { product_id: v })}
                                                                options={sourceProducts.map(p => ({ value: p.id, label: p.name, hint: `متوفر: ${p.stock}` }))}
                                                                placeholder="اختر الصنف…" testid={`transfer-row-product-${i}`} />
                                                        </td>
                                                        <td className="p-2"><Input type="number" value={r.qty} min="0.001" step="0.001" onChange={(e) => setRow(i, { qty: +e.target.value })} className="h-9" data-testid={`transfer-row-qty-${i}`} /></td>
                                                        <td className="p-2 tabular-nums text-slate-600">{p ? p.stock : "—"}</td>
                                                        <td className="p-2"><Button size="sm" variant="outline" onClick={() => removeRow(i)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <Button variant="ghost" onClick={addRow} className="w-full gap-2" disabled={!form.from_warehouse_id} data-testid="transfer-add-row"><Plus className="w-4 h-4" /> إضافة صنف</Button>
                                </div>
                                <div>
                                    <Label>ملاحظات</Label>
                                    <Input value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} placeholder="اختياري..." />
                                </div>
                            </div>
                            <DialogFooter><Button onClick={submit} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="save-transfer-btn"><ArrowLeftRight className="w-4 h-4" /> تنفيذ التحويل</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600">
                        <tr><th className="p-3">رقم</th><th className="p-3">التاريخ</th><th className="p-3">من</th><th className="p-3">إلى</th><th className="p-3">الأصناف</th><th className="p-3">الموظف</th><th className="p-3"></th></tr>
                    </thead>
                    <tbody>
                        {items.map(t => (
                            <tr key={t.id} className="border-b border-zinc-100" data-testid={`transfer-row-${t.id}`}>
                                <td className="p-3 tabular-nums font-mono">#{t.transfer_no}</td>
                                <td className="p-3 tabular-nums text-slate-600">{t.created_at?.substring(0,16).replace("T"," ")}</td>
                                <td className="p-3">{t.from_warehouse_name}</td>
                                <td className="p-3">{t.to_warehouse_name}</td>
                                <td className="p-3 tabular-nums">{t.items?.length}</td>
                                <td className="p-3 text-slate-600">{t.user_name}</td>
                                <td className="p-3"><Button size="sm" variant="outline" onClick={() => printVoucher(t)} data-testid={`print-transfer-${t.id}`} className="gap-1"><Printer className="w-3.5 h-3.5" /> طباعة</Button></td>
                            </tr>
                        ))}
                        {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400"><PackageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" /> لا توجد تحويلات بعد</td></tr>}
                    </tbody>
                </table>
            </Card>

            {preview && (
                <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
                    <DialogContent dir="rtl" className="bg-white">
                        <DialogHeader><DialogTitle>تمّ تنفيذ التحويل #{preview.transfer_no}</DialogTitle></DialogHeader>
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between"><span className="text-slate-500">من</span><b>{preview.from_warehouse_name}</b></div>
                            <div className="flex justify-between"><span className="text-slate-500">إلى</span><b>{preview.to_warehouse_name}</b></div>
                            <div className="flex justify-between"><span className="text-slate-500">عدد الأصناف</span><b className="tabular-nums">{preview.items.length}</b></div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setPreview(null)}>إغلاق</Button>
                            <Button onClick={() => printVoucher(preview)} className="bg-slate-900 hover:bg-slate-800 text-white gap-2"><Printer className="w-4 h-4" /> طباعة الإذن</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
