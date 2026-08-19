import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Shifts() {
    const [items, setItems] = useState([]);
    useEffect(() => { api.get("/shifts").then(r => setItems(r.data)); }, []);
    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200"><h3 className="font-semibold">سجل الورديات</h3><p className="text-xs text-slate-500">{items.length} وردية</p></div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600">
                    <tr><th className="p-3">الكاشير</th><th className="p-3">افتُتحت</th><th className="p-3">أُغلقت</th><th className="p-3">افتتاح</th><th className="p-3">فعلي</th><th className="p-3">مبيعات</th><th className="p-3">الفرق</th></tr>
                </thead>
                <tbody>
                    {items.map(s => {
                        const sum = s.summary || {};
                        const v = sum.variance;
                        return (
                            <tr key={s.id} className="border-b border-zinc-100">
                                <td className="p-3 font-medium">{s.user_name}</td>
                                <td className="p-3 tabular-nums text-slate-600">{s.opened_at?.substring(0,16).replace("T"," ")}</td>
                                <td className="p-3 tabular-nums text-slate-600">{s.closed_at ? s.closed_at.substring(0,16).replace("T"," ") : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">مفتوحة</Badge>}</td>
                                <td className="p-3 tabular-nums">{fmt(s.opening_cash || 0)}</td>
                                <td className="p-3 tabular-nums">{s.closing_cash != null ? fmt(s.closing_cash) : "—"}</td>
                                <td className="p-3 tabular-nums font-semibold text-emerald-700">{sum.total_sales != null ? fmt(sum.total_sales) : "—"}</td>
                                <td className={`p-3 tabular-nums font-semibold ${v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-slate-700"}`}>{v != null ? (v > 0 ? "+" : "") + fmt(v) : "—"}</td>
                            </tr>
                        );
                    })}
                    {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">لا توجد ورديات بعد</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}
