import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";

const ACTION_LABEL = {
    promotion_create: "إنشاء عرض",
    promotion_update: "تعديل عرض",
    promotion_delete: "حذف عرض",
    loyalty_settings: "إعدادات الولاء",
    price_change: "تعديل سعر",
    invoice_void: "إلغاء فاتورة",
    drawer_open: "فتح درج النقد",
    stock_adjust: "تسوية مخزون",
};

export default function AuditLog() {
    const [rows, setRows] = useState([]);
    const [q, setQ] = useState("");
    useEffect(() => { api.get("/audit-log").then(r => setRows(r.data)); }, []);
    const filtered = rows.filter(r => !q || r.description.includes(q) || (r.user_name || "").includes(q) || (ACTION_LABEL[r.action] || r.action).includes(q));

    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b flex items-center justify-between">
                <div><h3 className="font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-600" /> سجل العمليات</h3><p className="text-xs text-slate-500">{rows.length} عملية مسجّلة</p></div>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث…" className="max-w-md" data-testid="audit-search" />
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">التاريخ</th><th className="p-3">المستخدم</th><th className="p-3">العملية</th><th className="p-3">الوصف</th></tr></thead>
                <tbody>
                    {filtered.map(r => (
                        <tr key={r.id} className="border-b border-zinc-100">
                            <td className="p-3 tabular-nums text-slate-600">{r.created_at?.substring(0, 16).replace("T", " ")}</td>
                            <td className="p-3">{r.user_name}</td>
                            <td className="p-3"><Badge className="bg-indigo-100 text-indigo-800">{ACTION_LABEL[r.action] || r.action}</Badge></td>
                            <td className="p-3">{r.description}</td>
                        </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">لا توجد عمليات مسجّلة بعد</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}
