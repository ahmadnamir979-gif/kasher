import { useEffect, useState } from "react";
import { api, formatApiError, fmt, fmtInt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function ExpiryAlerts() {
    const [data, setData] = useState({ near_expiry: [], expired: [], days_window: 30 });
    const [days, setDays] = useState(30);

    const load = async (d = days) => {
        try { const r = await api.get("/expiry/near", { params: { days: d } }); setData(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">تواريخ الصلاحية والإنذارات</h2>
                    <p className="text-sm text-slate-500">{data.expired.length} صنف منتهي • {data.near_expiry.length} صنف قارب الانتهاء</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm">إنذار قبل:</label>
                    <Input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} onBlur={e => load(e.target.value)} className="max-w-[100px]" data-testid="exp-days" />
                    <span className="text-sm text-slate-500">يوم</span>
                </div>
            </div>

            {data.expired.length > 0 && (
                <Card className="border-rose-200">
                    <div className="p-4 border-b border-rose-200 bg-rose-50">
                        <h3 className="font-semibold text-rose-800">أصناف منتهية الصلاحية ({data.expired.length})</h3>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-xs text-right"><tr><th className="p-3">الصنف</th><th className="p-3">الباركود</th><th className="p-3">تاريخ الانتهاء</th><th className="p-3">المخزون</th><th className="p-3">الخسارة المحتملة</th></tr></thead>
                        <tbody>
                            {data.expired.map(p => (
                                <tr key={p.id} className="border-t border-zinc-100 bg-rose-50/30">
                                    <td className="p-3 font-semibold">{p.name}</td>
                                    <td className="p-3 tabular-nums font-mono text-xs">{p.barcode}</td>
                                    <td className="p-3 tabular-nums text-rose-700 font-semibold">{p.expiry_date}</td>
                                    <td className="p-3 tabular-nums">{fmtInt(p.stock)}</td>
                                    <td className="p-3 tabular-nums text-rose-700">{fmt((p.stock || 0) * (p.cost_price || 0))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Card className="border-amber-200">
                <div className="p-4 border-b border-amber-200 bg-amber-50">
                    <h3 className="font-semibold text-amber-800">تنبيه: تنتهي خلال {data.days_window} يوم ({data.near_expiry.length})</h3>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs text-right"><tr><th className="p-3">الصنف</th><th className="p-3">الباركود</th><th className="p-3">تاريخ الانتهاء</th><th className="p-3">المخزون</th><th className="p-3">الأيام المتبقية</th></tr></thead>
                    <tbody>
                        {data.near_expiry.map(p => {
                            const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / 86400000);
                            return (
                                <tr key={p.id} className="border-t border-zinc-100">
                                    <td className="p-3 font-semibold">{p.name}</td>
                                    <td className="p-3 tabular-nums font-mono text-xs">{p.barcode}</td>
                                    <td className="p-3 tabular-nums">{p.expiry_date}</td>
                                    <td className="p-3 tabular-nums">{fmtInt(p.stock)}</td>
                                    <td className="p-3"><Badge className={daysLeft <= 7 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}>{daysLeft} يوم</Badge></td>
                                </tr>
                            );
                        })}
                        {data.near_expiry.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">لا أصناف على وشك الانتهاء</td></tr>}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
