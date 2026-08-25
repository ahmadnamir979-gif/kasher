import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export default function PricingTiers() {
    const [tiers, setTiers] = useState([]);
    const [products, setProducts] = useState([]);
    const [prices, setPrices] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", discount_percent: 0 });
    const [selTier, setSelTier] = useState("");
    const [priceMap, setPriceMap] = useState({});

    const load = async () => {
        try {
            const [t, p, pr] = await Promise.all([api.get("/pricing-tiers"), api.get("/products"), api.get("/product-tier-prices")]);
            setTiers(t.data); setProducts(p.data); setPrices(pr.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    useEffect(() => {
        if (selTier) {
            const map = {};
            prices.filter(x => x.tier_id === selTier).forEach(x => { map[x.product_id] = x.price; });
            setPriceMap(map);
        }
    }, [selTier, prices]);

    const submit = async () => {
        try { await api.post("/pricing-tiers", { ...form, discount_percent: Number(form.discount_percent) }); toast.success("تم"); setOpen(false); setForm({ name: "", discount_percent: 0 }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف الفئة؟")) return;
        try { await api.delete(`/pricing-tiers/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const setPrice = async (product_id, price) => {
        try {
            await api.post("/product-tier-prices", { product_id, tier_id: selTier, price: Number(price) });
            setPriceMap(m => ({ ...m, [product_id]: Number(price) }));
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Tag className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">فئات الأسعار</h2>
                    <p className="text-sm text-slate-500">{tiers.length} فئة سعرية (جملة/تجزئة/VIP...)</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="tier-add-btn"><Plus className="w-4 h-4" />فئة جديدة</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs"><tr><th className="p-3">الاسم</th><th className="p-3">نسبة الخصم%</th><th className="p-3"></th></tr></thead>
                    <tbody>
                        {tiers.map(t => (
                            <tr key={t.id} className="border-b" data-testid={`tier-row-${t.id}`}>
                                <td className="p-3 font-semibold">{t.name}</td>
                                <td className="p-3 tabular-nums">{t.discount_percent}%</td>
                                <td className="p-3"><Button size="sm" variant="ghost" onClick={() => remove(t.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button></td>
                            </tr>
                        ))}
                        {tiers.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-slate-400">لا توجد فئات</td></tr>}
                    </tbody>
                </table>
            </Card>

            {tiers.length > 0 && (
                <Card className="p-4 border-zinc-200">
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="font-semibold">أسعار الأصناف لكل فئة</h3>
                        <Select value={selTier} onValueChange={setSelTier}>
                            <SelectTrigger className="max-w-xs" data-testid="tier-select-prices"><SelectValue placeholder="اختر فئة..." /></SelectTrigger>
                            <SelectContent>{tiers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {selTier && (
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-xs"><tr><th className="p-2">الصنف</th><th className="p-2">السعر الأساسي</th><th className="p-2">سعر الفئة</th></tr></thead>
                            <tbody>
                                {products.slice(0, 100).map(p => (
                                    <tr key={p.id} className="border-t border-zinc-100">
                                        <td className="p-2">{p.name}</td>
                                        <td className="p-2 tabular-nums text-slate-500">{fmt(p.price)}</td>
                                        <td className="p-2"><Input type="number" step="0.01" defaultValue={priceMap[p.id] || ""} placeholder={fmt(p.price)} onBlur={e => e.target.value && setPrice(p.id, e.target.value)} className="max-w-xs" data-testid={`tier-price-${p.id}`} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>فئة سعرية جديدة</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="الاسم (مثلاً جملة/VIP)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="tier-name" />
                        <div><label className="text-xs">نسبة الخصم الافتراضية %</label><Input type="number" step="0.1" value={form.discount_percent} onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} data-testid="tier-save">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
