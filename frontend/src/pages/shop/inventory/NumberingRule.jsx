import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Hash } from "lucide-react";
import { toast } from "sonner";

export default function NumberingRule() {
    const [rule, setRule] = useState(null);
    const [preview, setPreview] = useState("");

    const load = async () => {
        try {
            const r = await api.get("/inventory/numbering-rule");
            setRule(r.data);
            const p = await api.get("/inventory/numbering-rule/next");
            setPreview(p.data.enabled ? p.data.code : "غير مُفعّل");
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const save = async () => {
        try {
            await api.put("/inventory/numbering-rule", {
                prefix: rule.prefix || "",
                next_number: Number(rule.next_number || 1),
                pad_width: Number(rule.pad_width || 5),
                enabled: !!rule.enabled,
            });
            toast.success("تم الحفظ");
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    if (!rule) return <div className="p-8 text-center text-slate-400">جاري التحميل...</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Hash className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">قواعد ترقيم الأصناف</h2>
                    <p className="text-sm text-slate-500">توليد أرقام أصناف تلقائية عند إضافة صنف جديد بدون باركود</p>
                </div>
            </div>

            <Card className="p-6 border-zinc-200 space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rule.enabled} onChange={e => setRule(r => ({ ...r, enabled: e.target.checked }))} className="w-5 h-5" data-testid="num-enabled" />
                    <span className="font-semibold">تفعيل الترقيم التلقائي</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-slate-600">البادئة (Prefix)</label>
                        <Input placeholder="مثلاً: SKU- أو 20" value={rule.prefix || ""} onChange={e => setRule(r => ({ ...r, prefix: e.target.value }))} data-testid="num-prefix" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600">الرقم التالي</label>
                        <Input type="number" min="1" value={rule.next_number} onChange={e => setRule(r => ({ ...r, next_number: e.target.value }))} data-testid="num-next" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-600">عرض الرقم (Padding)</label>
                        <Input type="number" min="1" max="10" value={rule.pad_width} onChange={e => setRule(r => ({ ...r, pad_width: e.target.value }))} data-testid="num-pad" />
                    </div>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-xs text-amber-700 mb-1">معاينة الرقم التالي</div>
                    <div className="text-2xl font-mono font-bold text-amber-900" data-testid="num-preview">
                        {rule.enabled ? `${rule.prefix || ""}${String(rule.next_number).padStart(rule.pad_width, "0")}` : "—"}
                    </div>
                </div>
                <div className="text-xs text-slate-500">
                    عند إضافة صنف جديد بدون باركود، يعطيه النظام هذا الرقم تلقائياً ثم ينتقل للرقم التالي.
                    <br />أمثلة: <Badge variant="outline">SKU-00001</Badge> <Badge variant="outline">201000045</Badge> <Badge variant="outline">A-0001</Badge>
                </div>
                <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="num-save">حفظ القاعدة</Button>
            </Card>
        </div>
    );
}
