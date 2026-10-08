import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DeadStock() {
    const [days, setDays] = useState(60);
    const [data, setData] = useState(null);
    useEffect(() => { api.get(`/inventory/dead-stock?days=${days}`).then(r => setData(r.data)); }, [days]);
    if (!data) return <div className="text-slate-500">جارٍ التحميل…</div>;
    return (
        <div className="space-y-4">
            <Card className="p-5 border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="font-semibold">أصناف راكدة — لم تُبع خلال آخر {days} يوم</h3>
                        <p className="text-xs text-slate-500">عدد: {data.count} · قيمة إجمالية: {fmt(data.total_value)}</p>
                    </div>
                    <div className="flex gap-1">
                        {[30, 60, 90, 180].map(d => (
                            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)} className={days === d ? "bg-slate-900 hover:bg-slate-800 text-white" : ""} data-testid={`period-${d}`}>{d} يوم</Button>
                        ))}
                    </div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-xs text-slate-600 text-right">
                        <tr><th className="p-3">الصنف</th><th className="p-3">الباركود</th><th className="p-3">الكمية</th><th className="p-3">التكلفة</th><th className="p-3">القيمة</th><th className="p-3">آخر تحديث</th></tr>
                    </thead>
                    <tbody>
                        {data.items.map(p => (
                            <tr key={p.id} className="border-b border-zinc-100">
                                <td className="p-3 font-medium">{p.name}</td>
                                <td className="p-3 font-mono text-xs">{p.barcode || "—"}</td>
                                <td className="p-3 tabular-nums">{fmt(p.stock)}</td>
                                <td className="p-3 tabular-nums">{fmt(p.cost_price)}</td>
                                <td className="p-3 tabular-nums font-semibold text-rose-700">{fmt(p.value)}</td>
                                <td className="p-3 tabular-nums text-slate-500">{p.last_update}</td>
                            </tr>
                        ))}
                        {data.items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-emerald-600">ممتاز — لا توجد أصناف راكدة</td></tr>}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
