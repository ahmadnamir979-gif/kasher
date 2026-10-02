import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ProductMovement() {
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState("");
    const [data, setData] = useState(null);
    useEffect(() => { api.get("/products").then(r => setProducts(r.data)); }, []);
    useEffect(() => {
        if (!selected) return setData(null);
        api.get(`/products/${selected}/movements`).then(r => setData(r.data)).catch(e => toast.error(formatApiError(e)));
    }, [selected]);

    const colorFor = (t) => ({
        "شراء": "bg-emerald-100 text-emerald-800",
        "بيع": "bg-blue-100 text-blue-800",
        "مرتجع مبيعات": "bg-amber-100 text-amber-800",
        "مرتجع مشتريات": "bg-orange-100 text-orange-800",
        "تحويل": "bg-slate-100 text-slate-800",
        "تسوية": "bg-purple-100 text-purple-800",
    }[t] || "bg-zinc-100");

    return (
        <div className="space-y-4">
            <Card className="p-4">
                <Label>اختر الصنف</Label>
                <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full h-10 border border-zinc-200 rounded-md px-3 bg-white mt-1" data-testid="prod-select">
                    <option value="">—</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.barcode})</option>)}
                </select>
            </Card>
            {data && (
                <Card className="border-zinc-200">
                    <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">كاردكس — {data.product.name}</h3>
                            <p className="text-xs text-slate-500">الباركود: {data.product.barcode || "—"} · الوحدة: {data.product.unit}</p>
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-slate-500">الرصيد المحسوب</div>
                            <div className="text-2xl font-bold tabular-nums">{fmt(data.closing)}</div>
                            <div className="text-xs text-slate-500">المخزون الحالي: {fmt(data.product.stock)}</div>
                        </div>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b text-xs text-slate-600 text-right">
                            <tr><th className="p-3">التاريخ</th><th className="p-3">النوع</th><th className="p-3">المرجع</th><th className="p-3">الطرف</th><th className="p-3">وارد</th><th className="p-3">صادر</th><th className="p-3">السعر</th><th className="p-3">الرصيد</th></tr>
                        </thead>
                        <tbody>
                            {data.movements.map((m, i) => (
                                <tr key={i} className="border-b border-zinc-100">
                                    <td className="p-3 tabular-nums text-slate-600">{m.date}</td>
                                    <td className="p-3"><Badge className={colorFor(m.type)}>{m.type}</Badge></td>
                                    <td className="p-3 font-mono text-xs">{m.ref}</td>
                                    <td className="p-3">{m.party}</td>
                                    <td className="p-3 tabular-nums text-emerald-700 font-semibold">{m.in ? fmt(m.in) : "—"}</td>
                                    <td className="p-3 tabular-nums text-rose-700 font-semibold">{m.out ? fmt(m.out) : "—"}</td>
                                    <td className="p-3 tabular-nums">{m.price ? fmt(m.price) : "—"}</td>
                                    <td className="p-3 tabular-nums font-bold">{fmt(m.balance)}</td>
                                </tr>
                            ))}
                            {data.movements.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">لا توجد حركات</td></tr>}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
