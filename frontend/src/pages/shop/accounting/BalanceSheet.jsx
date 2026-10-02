import { useEffect, useState } from "react";
import { api, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";

export default function BalanceSheet() {
    const [d, setD] = useState(null);
    useEffect(() => { api.get("/reports/balance-sheet").then(r => setD(r.data)); }, []);
    if (!d) return <div className="text-slate-500">جارٍ التحميل…</div>;
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5 border-r-4 border-emerald-500">
                    <h3 className="font-bold text-lg mb-4 text-emerald-800">الأصول</h3>
                    <div className="space-y-2 text-sm">
                        <Row label="النقد في الصندوق" value={d.assets.cash} />
                        <Row label="النقد في البنك" value={d.assets.bank} />
                        <Row label="المخزون (بسعر التكلفة)" value={d.assets.inventory} />
                        <Row label="الذمم المدينة (العملاء)" value={d.assets.receivable} />
                        <Row label="الأصول الثابتة" value={d.assets.fixed_assets} />
                        <div className="border-t pt-2 flex justify-between font-bold text-base"><span>إجمالي الأصول</span><span className="tabular-nums text-emerald-700">{fmt(d.assets.total)}</span></div>
                    </div>
                </Card>
                <Card className="p-5 border-r-4 border-rose-500">
                    <h3 className="font-bold text-lg mb-4 text-rose-800">الالتزامات وحقوق الملكية</h3>
                    <div className="space-y-2 text-sm">
                        <Row label="الذمم الدائنة (الموردين)" value={d.liabilities.payable} />
                        <div className="border-t pt-2 flex justify-between font-bold"><span>إجمالي الالتزامات</span><span className="tabular-nums text-rose-700">{fmt(d.liabilities.total)}</span></div>
                        <div className="pt-4 border-t mt-4">
                            <Row label="حقوق الملكية (صافي)" value={d.equity.net_worth} bold />
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold text-base"><span>إجمالي الالتزامات وحقوق الملكية</span><span className="tabular-nums">{fmt(d.liabilities.total + d.equity.net_worth)}</span></div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

function Row({ label, value, bold }) {
    return <div className={`flex justify-between ${bold ? "font-bold" : ""}`}><span className="text-slate-700">{label}</span><span className="tabular-nums">{fmt(value)}</span></div>;
}
