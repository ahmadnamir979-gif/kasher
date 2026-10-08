import { useEffect, useState } from "react";
import { api, formatApiError, fmt, fmtInt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Star } from "lucide-react";

export default function Loyalty() {
    const [s, setS] = useState(null);
    const [top, setTop] = useState([]);
    useEffect(() => {
        api.get("/loyalty/settings").then(r => setS(r.data));
        api.get("/loyalty/top").then(r => setTop(r.data));
    }, []);

    const save = async () => {
        try { await api.post("/loyalty/settings", s); toast.success("تم الحفظ"); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    if (!s) return <div className="text-slate-500">جارٍ التحميل…</div>;

    const tierOf = (pts) => pts >= s.vip_threshold ? "VIP" : pts >= s.gold_threshold ? "Gold" : pts >= s.silver_threshold ? "Silver" : "—";
    const tierColor = (t) => ({ VIP: "bg-violet-600 text-white", Gold: "bg-amber-500 text-white", Silver: "bg-zinc-400 text-white" }[t] || "bg-zinc-100");

    return (
        <div className="space-y-4">
            <Card className="p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-4"><Star className="w-5 h-5 text-amber-500" /> إعدادات برنامج الولاء</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={s.enabled} onChange={(e) => setS({...s, enabled: e.target.checked})} data-testid="loy-enabled" />
                        <Label>تفعيل برنامج الولاء</Label>
                    </div>
                    <div></div>
                    <div><Label>نقاط لكل 1 شيكل مبيعات</Label><Input type="number" value={s.points_per_currency} onChange={(e) => setS({...s, points_per_currency: +e.target.value})} data-testid="loy-points" /></div>
                    <div><Label>نقاط مقابل 1 شيكل خصم (الاستبدال)</Label><Input type="number" value={s.redeem_rate} onChange={(e) => setS({...s, redeem_rate: +e.target.value})} data-testid="loy-redeem" /></div>
                    <div><Label>الحد الأدنى للاستبدال (نقاط)</Label><Input type="number" value={s.min_redeem_points} onChange={(e) => setS({...s, min_redeem_points: +e.target.value})} /></div>
                    <div></div>
                    <div><Label>Silver — بعد (نقطة)</Label><Input type="number" value={s.silver_threshold} onChange={(e) => setS({...s, silver_threshold: +e.target.value})} /></div>
                    <div><Label>Gold — بعد (نقطة)</Label><Input type="number" value={s.gold_threshold} onChange={(e) => setS({...s, gold_threshold: +e.target.value})} /></div>
                    <div><Label>VIP — بعد (نقطة)</Label><Input type="number" value={s.vip_threshold} onChange={(e) => setS({...s, vip_threshold: +e.target.value})} /></div>
                </div>
                <div className="mt-4"><Button onClick={save} className="bg-slate-900 text-white gap-2" data-testid="save-loy"><Save className="w-4 h-4" /> حفظ الإعدادات</Button></div>
            </Card>
            <Card className="border-zinc-200">
                <div className="p-5 border-b"><h3 className="font-semibold">أعلى العملاء بالنقاط</h3></div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-right text-xs text-slate-600"><tr><th className="p-3">#</th><th className="p-3">العميل</th><th className="p-3">النقاط</th><th className="p-3">المستوى</th><th className="p-3">قيمة الاستبدال</th></tr></thead>
                    <tbody>
                        {top.map((c, i) => {
                            const t = tierOf(c.loyalty_points || 0);
                            return (
                                <tr key={c.id} className="border-b border-zinc-100">
                                    <td className="p-3 text-slate-400">{i + 1}</td>
                                    <td className="p-3 font-medium">{c.name}</td>
                                    <td className="p-3 tabular-nums font-bold text-amber-700">{fmtInt(c.loyalty_points || 0)}</td>
                                    <td className="p-3"><Badge className={tierColor(t)}>{t}</Badge></td>
                                    <td className="p-3 tabular-nums text-emerald-700">{fmt((c.loyalty_points || 0) / s.redeem_rate)}</td>
                                </tr>
                            );
                        })}
                        {top.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا يوجد عملاء بنقاط بعد</td></tr>}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
