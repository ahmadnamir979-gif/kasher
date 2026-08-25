import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Alternatives() {
    const [products, setProducts] = useState([]);
    const [selected, setSelected] = useState("");
    const [alts, setAlts] = useState([]);
    const [pick, setPick] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        api.get("/products").then(r => setProducts(r.data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (!selected) { setAlts([]); return; }
        api.get(`/products/${selected}/alternatives`).then(r => setAlts(r.data)).catch(e => toast.error(formatApiError(e)));
    }, [selected]);

    const addAlt = async () => {
        if (!pick || !selected) return;
        try {
            await api.post(`/products/${selected}/alternatives`, { product_id: selected, alt_product_id: pick });
            toast.success("تم الربط بين الصنفين");
            setPick("");
            const r = await api.get(`/products/${selected}/alternatives`);
            setAlts(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const removeAlt = async (altId) => {
        try {
            await api.delete(`/products/${selected}/alternatives/${altId}`);
            const r = await api.get(`/products/${selected}/alternatives`);
            setAlts(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const filtered = products.filter(p => !search || p.name.includes(search) || (p.barcode || "").includes(search));
    const otherProducts = products.filter(p => p.id !== selected && !alts.find(a => a.alt_product_id === p.id));

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Repeat className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">بدائل الأصناف</h2>
                    <p className="text-sm text-slate-500">اربط الأصناف بأصناف مشابهة لعرض بدائل عند نفاد المخزون (مفيد لقطع الغيار)</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Card className="border-zinc-200">
                    <div className="p-4 border-b">
                        <Input placeholder="بحث عن صنف..." value={search} onChange={e => setSearch(e.target.value)} data-testid="alt-search" />
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        {filtered.slice(0, 100).map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelected(p.id)}
                                className={`p-3 border-b border-zinc-100 cursor-pointer ${selected === p.id ? "bg-amber-50 border-amber-300" : "hover:bg-zinc-50"}`}
                                data-testid={`alt-prod-${p.id}`}
                            >
                                <div className="font-semibold">{p.name}</div>
                                <div className="text-xs text-slate-500">{p.barcode}</div>
                            </div>
                        ))}
                        {filtered.length === 0 && <div className="p-8 text-center text-slate-400">لا نتائج</div>}
                    </div>
                </Card>

                <Card className="border-zinc-200 p-4">
                    {!selected ? (
                        <div className="text-center text-slate-400 p-8">اختر صنفاً من القائمة اليسرى لعرض بدائله</div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <h3 className="font-bold">بدائل: {products.find(p => p.id === selected)?.name}</h3>
                                <p className="text-xs text-slate-500 mt-1">{alts.length} بديل</p>
                            </div>
                            <div className="flex gap-2 mb-4">
                                <Select value={pick} onValueChange={setPick}>
                                    <SelectTrigger className="flex-1" data-testid="alt-pick"><SelectValue placeholder="اختر صنفاً بديلاً..." /></SelectTrigger>
                                    <SelectContent>{otherProducts.slice(0, 200).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button onClick={addAlt} disabled={!pick} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="alt-add"><Plus className="w-4 h-4" />ربط</Button>
                            </div>
                            <div className="space-y-2">
                                {alts.map(a => (
                                    <div key={a.alt_product_id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border" data-testid={`alt-item-${a.alt_product_id}`}>
                                        <Repeat className="w-4 h-4 text-amber-600" />
                                        <div className="flex-1">
                                            <div className="font-semibold">{a.alternative?.name || "-"}</div>
                                            <div className="text-xs text-slate-500">رصيد: {a.alternative?.stock || 0} • سعر: {a.alternative?.sale_price || 0}</div>
                                        </div>
                                        <Badge variant="outline">{a.alternative?.barcode}</Badge>
                                        <Button size="sm" variant="ghost" onClick={() => removeAlt(a.alt_product_id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                ))}
                                {alts.length === 0 && <div className="text-center text-slate-400 p-6">لا بدائل بعد. اختر صنفاً وأضفه.</div>}
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
