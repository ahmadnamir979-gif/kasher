import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Gift } from "lucide-react";
import { toast } from "sonner";
import SearchSelect from "@/components/SearchSelect";

const KINDS = {
    percent: "خصم نسبة %",
    fixed: "خصم مبلغ ثابت",
    bogo: "اشتر X واحصل على Y",
    bundle: "مجموعة بسعر خاص (مثلاً 3 بـ 10)",
};

export default function Promotions() {
    const [items, setItems] = useState([]);
    const [products, setProducts] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(defaultForm());

    const load = async () => {
        setItems((await api.get("/promotions")).data);
        setProducts((await api.get("/products")).data);
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        try {
            const payload = { ...form,
                product_id: form.product_id || null,
                category_id: null,
                days_of_week: form.days_of_week?.length ? form.days_of_week : null,
                time_from: form.time_from || null,
                time_to: form.time_to || null,
                starts_at: form.starts_at || null,
                ends_at: form.ends_at || null,
            };
            await api.post("/promotions", payload);
            toast.success("تم حفظ العرض");
            setOpen(false); setForm(defaultForm()); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const del = async (p) => {
        if (!window.confirm(`حذف العرض ${p.name}؟`)) return;
        await api.delete(`/promotions/${p.id}`); load();
    };

    const toggleDay = (d) => {
        setForm(f => {
            const cur = f.days_of_week || [];
            return { ...f, days_of_week: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] };
        });
    };

    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b flex items-center justify-between">
                <div><h3 className="font-semibold flex items-center gap-2"><Gift className="w-5 h-5 text-emerald-600" /> العروض والخصومات</h3><p className="text-xs text-slate-500">{items.length} عرض نشط</p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" data-testid="add-promo-btn"><Plus className="w-4 h-4" /> عرض جديد</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>عرض جديد</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            <div><Label>اسم العرض</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} data-testid="promo-name" /></div>
                            <div><Label>نوع العرض</Label>
                                <SearchSelect value={form.kind} onChange={(v) => setForm(f => ({...f, kind: v}))}
                                    options={Object.entries(KINDS).map(([k, v]) => ({ value: k, label: v }))}
                                    testid="promo-kind" className="mt-1" />
                            </div>
                            {form.kind === "percent" && (
                                <div><Label>نسبة الخصم %</Label><Input type="number" value={form.percent_off} onChange={(e) => setForm(f => ({...f, percent_off: +e.target.value}))} /></div>
                            )}
                            {form.kind === "fixed" && (
                                <>
                                    <div><Label>مبلغ الخصم</Label><Input type="number" value={form.amount_off} onChange={(e) => setForm(f => ({...f, amount_off: +e.target.value}))} /></div>
                                    <div><Label>الحد الأدنى للفاتورة</Label><Input type="number" value={form.min_total} onChange={(e) => setForm(f => ({...f, min_total: +e.target.value}))} /></div>
                                </>
                            )}
                            {form.kind === "bogo" && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div><Label>اشتر (كمية)</Label><Input type="number" value={form.buy_qty} onChange={(e) => setForm(f => ({...f, buy_qty: +e.target.value}))} /></div>
                                    <div><Label>احصل مجاناً (كمية)</Label><Input type="number" value={form.get_qty} onChange={(e) => setForm(f => ({...f, get_qty: +e.target.value}))} /></div>
                                </div>
                            )}
                            {form.kind === "bundle" && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div><Label>الكمية في المجموعة</Label><Input type="number" value={form.bundle_qty} onChange={(e) => setForm(f => ({...f, bundle_qty: +e.target.value}))} /></div>
                                    <div><Label>سعر المجموعة</Label><Input type="number" value={form.bundle_price} onChange={(e) => setForm(f => ({...f, bundle_price: +e.target.value}))} /></div>
                                </div>
                            )}
                            <div><Label>الصنف (اختياري)</Label>
                                <SearchSelect value={form.product_id} onChange={(v) => setForm(f => ({...f, product_id: v}))}
                                    options={products.map(p => ({ value: p.id, label: p.name, hint: p.barcode }))}
                                    allowEmpty emptyLabel="— كل الأصناف —" placeholder="ابحث عن صنف…" className="mt-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label>يبدأ (اختياري)</Label><Input type="date" value={form.starts_at} onChange={(e) => setForm(f => ({...f, starts_at: e.target.value}))} /></div>
                                <div><Label>ينتهي (اختياري)</Label><Input type="date" value={form.ends_at} onChange={(e) => setForm(f => ({...f, ends_at: e.target.value}))} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label>من الساعة (مثال 18:00)</Label><Input placeholder="HH:MM" value={form.time_from} onChange={(e) => setForm(f => ({...f, time_from: e.target.value}))} /></div>
                                <div><Label>إلى الساعة</Label><Input placeholder="HH:MM" value={form.time_to} onChange={(e) => setForm(f => ({...f, time_to: e.target.value}))} /></div>
                            </div>
                            <div>
                                <Label>أيام الأسبوع (اضغط للتبديل)</Label>
                                <div className="flex gap-1 mt-1">
                                    {["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"].map((n, i) => (
                                        <button type="button" key={i} onClick={() => toggleDay(i)}
                                            className={`flex-1 h-9 rounded border text-xs ${(form.days_of_week || []).includes(i) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-zinc-200 hover:border-emerald-400"}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter><Button onClick={save} className="bg-slate-900 text-white" data-testid="save-promo-btn">حفظ العرض</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">الاسم</th><th className="p-3">النوع</th><th className="p-3">القيمة</th><th className="p-3">الصنف</th><th className="p-3">الفترة</th><th className="p-3">الحالة</th><th className="p-3"></th></tr></thead>
                <tbody>
                    {items.map(p => (
                        <tr key={p.id} className="border-b border-zinc-100">
                            <td className="p-3 font-medium">{p.name}</td>
                            <td className="p-3"><Badge className="bg-indigo-100 text-indigo-800">{KINDS[p.kind]}</Badge></td>
                            <td className="p-3 tabular-nums">{p.kind === "percent" ? `${p.percent_off}%` : p.kind === "fixed" ? fmt(p.amount_off) : p.kind === "bogo" ? `اشتر ${p.buy_qty} احصل على ${p.get_qty}` : `${p.bundle_qty} بـ ${fmt(p.bundle_price)}`}</td>
                            <td className="p-3 text-xs">{p.product_id ? (products.find(x => x.id === p.product_id)?.name || "—") : "كل الأصناف"}</td>
                            <td className="p-3 text-xs text-slate-500">{p.starts_at || "—"} → {p.ends_at || "—"}</td>
                            <td className="p-3">{p.is_active ? <Badge className="bg-emerald-100 text-emerald-800">نشط</Badge> : <Badge className="bg-zinc-200">متوقف</Badge>}</td>
                            <td className="p-3"><Button size="sm" variant="outline" onClick={() => del(p)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">لا توجد عروض — اضغط "عرض جديد"</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}

function defaultForm() {
    return { name: "", kind: "percent", product_id: "", buy_qty: 1, get_qty: 1,
        bundle_qty: 3, bundle_price: 10, percent_off: 10, amount_off: 5, min_total: 0,
        starts_at: "", ends_at: "", time_from: "", time_to: "", days_of_week: [], is_active: true };
}
