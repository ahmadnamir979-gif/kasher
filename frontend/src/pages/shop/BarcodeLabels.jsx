import { useEffect, useRef, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Barcode as BarcodeIcon } from "lucide-react";
import JsBarcode from "jsbarcode";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

function LabelPreview({ product, shop }) {
    const ref = useRef(null);
    useEffect(() => {
        if (product?.barcode && ref.current) {
            try {
                JsBarcode(ref.current, product.barcode, { format: "CODE128", displayValue: false, height: 40, width: 1.4, margin: 0 });
            } catch {}
        }
    }, [product]);
    if (!product) return null;
    return (
        <div style={{ width: "50mm", padding: "3mm", border: "1px dashed #ccc", background: "white", direction: "rtl", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }} className="label-item">
            <div style={{ fontSize: "10px", fontWeight: 600, textAlign: "center", marginBottom: "2px", color: "#000" }}>{shop?.name || ""}</div>
            <div style={{ fontSize: "11px", fontWeight: 700, textAlign: "center", lineHeight: 1.1, minHeight: "24px", color: "#000" }}>{product.name}</div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: "2px" }}>
                {product.barcode ? <svg ref={ref}></svg> : <div style={{ fontSize: "9px", color: "#999" }}>لا يوجد باركود</div>}
            </div>
            <div style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", letterSpacing: "1px", color: "#000" }}>{product.barcode}</div>
            <div style={{ fontSize: "13px", fontWeight: 800, textAlign: "center", marginTop: "2px", color: "#000" }} className="tabular-nums">{fmt(product.sale_price)}</div>
        </div>
    );
}

export default function BarcodeLabels() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState({});
    const [copies, setCopies] = useState({});
    const [q, setQ] = useState("");

    useEffect(() => { api.get("/products").then(r => setProducts(r.data)); }, []);

    const filtered = products.filter(p => !q || p.name.includes(q) || (p.barcode || "").includes(q));
    const selectedProducts = filtered.filter(p => selected[p.id]);
    const printableList = [];
    products.forEach(p => {
        if (selected[p.id]) {
            const n = Math.max(1, parseInt(copies[p.id] || 1));
            for (let i = 0; i < n; i++) printableList.push(p);
        }
    });

    const doPrint = () => {
        if (printableList.length === 0) return toast.error("اختر منتجاً واحداً على الأقل");
        const area = document.getElementById("labels-print-area");
        if (!area) return;
        const w = window.open("", "PRINT", "width=800,height=600");
        w.document.write(`<html dir="rtl"><head><title>Labels</title>
            <style>
                @page { size: A4; margin: 8mm; }
                body { margin: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
                .labels-grid { display: grid; grid-template-columns: repeat(4, 50mm); gap: 3mm; }
                .tabular-nums { font-variant-numeric: tabular-nums; }
            </style></head><body>${area.innerHTML}</body></html>`);
        w.document.close(); w.focus();
        setTimeout(() => { w.print(); w.close(); }, 400);
    };

    const generateAllBarcodes = async () => {
        const missing = products.filter(p => !p.barcode);
        if (missing.length === 0) return toast.info("جميع المنتجات لديها باركود");
        if (!window.confirm(`إنشاء باركود تلقائياً لـ ${missing.length} منتج؟`)) return;
        for (const p of missing) {
            const bc = "2" + Math.floor(1e11 + Math.random() * 8e11);
            await api.patch(`/products/${p.id}`, { ...p, barcode: bc });
        }
        toast.success(`تمّ إنشاء ${missing.length} باركود`);
        const { data } = await api.get("/products"); setProducts(data);
    };

    return (
        <div className="space-y-4">
            <Card className="p-4 border-zinc-200">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1">
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الباركود..." className="max-w-sm" data-testid="labels-search" />
                        <span className="text-sm text-slate-500">محدّد: <b className="text-slate-900 tabular-nums">{Object.values(selected).filter(Boolean).length}</b> منتج</span>
                        <span className="text-sm text-slate-500">/ للطباعة: <b className="text-slate-900 tabular-nums">{printableList.length}</b> ملصق</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={generateAllBarcodes} className="gap-2" data-testid="gen-barcodes-btn"><BarcodeIcon className="w-4 h-4" /> توليد باركود للمفقود</Button>
                        <Button onClick={doPrint} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="print-labels-btn"><Printer className="w-4 h-4" /> طباعة الملصقات</Button>
                    </div>
                </div>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-zinc-200 overflow-hidden">
                    <div className="p-3 bg-zinc-50 border-b flex items-center justify-between">
                        <h3 className="font-semibold text-sm">اختر المنتجات</h3>
                        <div className="flex gap-2 text-xs">
                            <button onClick={() => setSelected(Object.fromEntries(filtered.map(p => [p.id, true])))} className="text-blue-600 hover:underline">تحديد الكل</button>
                            <button onClick={() => setSelected({})} className="text-slate-500 hover:underline">إلغاء الكل</button>
                        </div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600 sticky top-0">
                                <tr><th className="p-2 w-8"></th><th className="p-2">المنتج</th><th className="p-2">الباركود</th><th className="p-2">السعر</th><th className="p-2 w-20">نسخ</th></tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id} className="border-b hover:bg-zinc-50/50" data-testid={`label-row-${p.id}`}>
                                        <td className="p-2"><Checkbox checked={!!selected[p.id]} onCheckedChange={(v) => setSelected(s => ({...s, [p.id]: !!v}))} /></td>
                                        <td className="p-2 font-medium">{p.name}</td>
                                        <td className="p-2 tabular-nums text-xs text-slate-600 font-mono">{p.barcode || <span className="text-rose-500">مفقود</span>}</td>
                                        <td className="p-2 tabular-nums">{fmt(p.sale_price)}</td>
                                        <td className="p-2"><Input type="number" min="1" value={copies[p.id] || 1} onChange={(e) => setCopies(c => ({...c, [p.id]: e.target.value}))} className="h-7 text-center" /></td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">لا نتائج</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </Card>
                <Card className="border-zinc-200 overflow-hidden">
                    <div className="p-3 bg-zinc-50 border-b"><h3 className="font-semibold text-sm">معاينة الملصقات</h3></div>
                    <div className="p-4 bg-zinc-100 max-h-[500px] overflow-y-auto">
                        <div id="labels-print-area">
                            <div className="labels-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 50mm)", gap: "3mm" }}>
                                {printableList.map((p, i) => <LabelPreview key={i} product={p} shop={user?.shop} />)}
                            </div>
                        </div>
                        {printableList.length === 0 && <div className="text-center text-slate-400 py-10 text-sm">اختر منتجات لعرض المعاينة</div>}
                    </div>
                </Card>
            </div>
        </div>
    );
}
