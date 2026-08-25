import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export default function BulkPrice() {
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({
        scope: "all",
        category_id: "",
        field: "sale_price",
        operation: "percent_up",
        value: 5,
        round_to: 0,
    });
    const [result, setResult] = useState(null);

    useEffect(() => {
        api.get("/categories").then(r => setCategories(r.data)).catch(() => { });
    }, []);

    const apply = async () => {
        if (!window.confirm("تطبيق التعديل على الأصناف؟ هذا سيغيّر أسعار المنتجات فعلياً.")) return;
        try {
            const r = await api.post("/inventory/bulk-price", {
                ...form,
                value: Number(form.value),
                round_to: form.round_to ? Number(form.round_to) : null,
                category_id: form.scope === "category" ? form.category_id : null,
            });
            setResult(r.data);
            toast.success(`تم تعديل ${r.data.products_updated} صنف من أصل ${r.data.products_scanned}`);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Calculator className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">معالجة أسعار الأصناف بالجملة</h2>
                    <p className="text-sm text-slate-500">رفع/تخفيض أسعار عدة أصناف مرة واحدة بنسبة أو مبلغ ثابت</p>
                </div>
            </div>

            <Card className="p-6 border-zinc-200 space-y-4 max-w-3xl">
                <div>
                    <label className="text-sm font-semibold">النطاق</label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        <label className={`p-3 border-2 rounded-lg cursor-pointer text-center ${form.scope === "all" ? "border-amber-500 bg-amber-50" : "border-zinc-200"}`}>
                            <input type="radio" checked={form.scope === "all"} onChange={() => setForm(f => ({ ...f, scope: "all" }))} className="hidden" data-testid="bp-scope-all" />
                            <div className="font-semibold">كل الأصناف</div>
                        </label>
                        <label className={`p-3 border-2 rounded-lg cursor-pointer text-center ${form.scope === "category" ? "border-amber-500 bg-amber-50" : "border-zinc-200"}`}>
                            <input type="radio" checked={form.scope === "category"} onChange={() => setForm(f => ({ ...f, scope: "category" }))} className="hidden" data-testid="bp-scope-category" />
                            <div className="font-semibold">فئة معينة</div>
                        </label>
                    </div>
                </div>

                {form.scope === "category" && (
                    <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                        <SelectTrigger data-testid="bp-category"><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                        <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs">الحقل</label>
                        <Select value={form.field} onValueChange={v => setForm(f => ({ ...f, field: v }))}>
                            <SelectTrigger data-testid="bp-field"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sale_price">سعر البيع</SelectItem>
                                <SelectItem value="cost_price">سعر التكلفة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs">العملية</label>
                        <Select value={form.operation} onValueChange={v => setForm(f => ({ ...f, operation: v }))}>
                            <SelectTrigger data-testid="bp-op"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="percent_up">رفع بنسبة %</SelectItem>
                                <SelectItem value="percent_down">تخفيض بنسبة %</SelectItem>
                                <SelectItem value="amount_up">إضافة مبلغ</SelectItem>
                                <SelectItem value="amount_down">خصم مبلغ</SelectItem>
                                <SelectItem value="set">تعيين قيمة ثابتة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs">{form.operation.startsWith("percent") ? "النسبة %" : "المبلغ"}</label>
                        <Input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} data-testid="bp-value" />
                    </div>
                    <div>
                        <label className="text-xs">تقريب لأقرب (اختياري)</label>
                        <Input type="number" step="0.5" value={form.round_to} onChange={e => setForm(f => ({ ...f, round_to: e.target.value }))} placeholder="مثلاً 0.5 أو 1" data-testid="bp-round" />
                    </div>
                </div>

                <div className={`p-4 rounded-lg border-2 ${form.operation.includes("up") ? "border-emerald-300 bg-emerald-50" : form.operation.includes("down") ? "border-rose-300 bg-rose-50" : "border-blue-300 bg-blue-50"}`}>
                    <div className="flex items-center gap-2 font-semibold">
                        {form.operation.includes("up") ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : form.operation.includes("down") ? <TrendingDown className="w-4 h-4 text-rose-600" /> : <Calculator className="w-4 h-4 text-blue-600" />}
                        مثال: صنف بسعر 100 → سيصبح
                        <span className="tabular-nums">{
                            form.operation === "percent_up" ? fmt(100 * (1 + form.value / 100))
                                : form.operation === "percent_down" ? fmt(100 * (1 - form.value / 100))
                                    : form.operation === "amount_up" ? fmt(100 + Number(form.value))
                                        : form.operation === "amount_down" ? fmt(Math.max(0, 100 - Number(form.value)))
                                            : fmt(form.value)
                        }</span>
                    </div>
                </div>

                <Button onClick={apply} className="w-full bg-purple-600 hover:bg-purple-700" data-testid="bp-apply">تطبيق التعديل</Button>

                {result && (
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-300 space-y-1">
                        <div>تم فحص <b>{result.products_scanned}</b> صنف</div>
                        <div>تم تعديل <b className="text-emerald-700">{result.products_updated}</b> صنف</div>
                        {result.sample && <div className="text-sm text-slate-600 mt-2">مثال أول تغيير: {result.sample.name}: {fmt(result.sample.old)} ← <b>{fmt(result.sample.new)}</b></div>}
                    </div>
                )}
            </Card>
        </div>
    );
}
