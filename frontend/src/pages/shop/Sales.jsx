import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
    const [items, setItems] = useState([]);
    useEffect(() => { api.get("/sales").then(r => setItems(r.data)); }, []);
    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200"><h3 className="font-semibold">فواتير المبيعات</h3><p className="text-xs text-slate-500">{items.length} فاتورة</p></div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600">
                        <tr><th className="p-3">رقم</th><th className="p-3">التاريخ</th><th className="p-3">الزبون</th><th className="p-3">الكاشير</th><th className="p-3">أصناف</th><th className="p-3">الإجمالي</th><th className="p-3">الربح</th><th className="p-3">الحالة</th></tr>
                    </thead>
                    <tbody>
                        {items.map(s => (
                            <tr key={s.id} className="border-b border-zinc-100" data-testid={`sale-row-${s.id}`}>
                                <td className="p-3 tabular-nums font-mono">#{s.invoice_no}</td>
                                <td className="p-3 tabular-nums text-slate-600">{s.created_at?.substring(0,16).replace("T"," ")}</td>
                                <td className="p-3">{s.customer_name}</td>
                                <td className="p-3 text-slate-600">{s.cashier_name}</td>
                                <td className="p-3 tabular-nums">{s.items?.length}</td>
                                <td className="p-3 tabular-nums font-semibold">{fmt(s.total)}</td>
                                <td className="p-3 tabular-nums text-emerald-700">{fmt(s.profit)}</td>
                                <td className="p-3">{s.is_return ? <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">مرتجع</Badge> : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{s.payment_method === "cash" ? "نقدي" : s.payment_method === "card" ? "بطاقة" : "آجل"}</Badge>}</td>
                            </tr>
                        ))}
                        {items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">لا توجد فواتير بعد</td></tr>}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
