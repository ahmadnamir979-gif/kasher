import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Landmark, TrendingUp, TrendingDown } from "lucide-react";

export default function Cashbox() {
    const [days, setDays] = useState(30);
    const [bal, setBal] = useState(null);
    const [mov, setMov] = useState(null);
    useEffect(() => {
        api.get("/cashbox/balance").then(r => setBal(r.data));
        api.get(`/cashbox/movements?days=${days}`).then(r => setMov(r.data));
    }, [days]);
    return (
        <div className="space-y-4">
            {bal && (
                <div className="grid grid-cols-3 gap-4">
                    <Card className="p-5 border-r-4 border-emerald-500"><div className="flex items-center gap-3"><Wallet className="w-10 h-10 text-emerald-600" /><div><div className="text-xs text-slate-500">رصيد الصندوق النقدي</div><div className="text-3xl font-bold tabular-nums">{fmt(bal.cash)}</div></div></div></Card>
                    <Card className="p-5 border-r-4 border-blue-500"><div className="flex items-center gap-3"><Landmark className="w-10 h-10 text-blue-600" /><div><div className="text-xs text-slate-500">رصيد البنك</div><div className="text-3xl font-bold tabular-nums">{fmt(bal.bank)}</div></div></div></Card>
                    <Card className="p-5 border-r-4 border-amber-500 bg-gradient-to-l from-amber-50 to-white"><div><div className="text-xs text-slate-500">الإجمالي</div><div className="text-3xl font-bold tabular-nums text-amber-800">{fmt(bal.total)}</div></div></Card>
                </div>
            )}
            {mov && (
                <Card className="border-zinc-200">
                    <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">حركة الصندوق — آخر {days} يوم</h3>
                            <div className="text-xs mt-1 flex gap-4">
                                <span className="text-emerald-700 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> داخل: {fmt(mov.total_in)}</span>
                                <span className="text-rose-700 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> خارج: {fmt(mov.total_out)}</span>
                                <span className="font-semibold">الصافي: {fmt(mov.net)}</span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            {[7, 30, 90].map(d => (
                                <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)} className={days === d ? "bg-slate-900 hover:bg-slate-800 text-white" : ""}>{d} يوم</Button>
                            ))}
                        </div>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b text-xs text-slate-600 text-right">
                            <tr><th className="p-3">التاريخ</th><th className="p-3">النوع</th><th className="p-3">المرجع</th><th className="p-3">الطرف</th><th className="p-3">وارد</th><th className="p-3">صادر</th></tr>
                        </thead>
                        <tbody>
                            {mov.rows.map((r, i) => (
                                <tr key={i} className="border-b border-zinc-100">
                                    <td className="p-3 tabular-nums text-slate-600">{r.date}</td>
                                    <td className="p-3">{r.type}</td>
                                    <td className="p-3 font-mono text-xs">{r.ref}</td>
                                    <td className="p-3">{r.party}</td>
                                    <td className="p-3 tabular-nums text-emerald-700 font-semibold">{r.in ? fmt(r.in) : "—"}</td>
                                    <td className="p-3 tabular-nums text-rose-700 font-semibold">{r.out ? fmt(r.out) : "—"}</td>
                                </tr>
                            ))}
                            {mov.rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد حركات</td></tr>}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
