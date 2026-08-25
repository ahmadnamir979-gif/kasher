import { useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Percent, RefreshCw, Printer } from "lucide-react";
import { toast } from "sonner";

export default function VatReport() {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + "-01";
    const [dateFrom, setDateFrom] = useState(monthStart);
    const [dateTo, setDateTo] = useState(today);
    const [rpt, setRpt] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try { const r = await api.get("/accounting/vat-report", { params: { date_from: dateFrom, date_to: dateTo } }); setRpt(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Percent className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">كشف ضريبة القيمة المضافة</h2>
                    <p className="text-sm text-slate-500">مقارنة ضريبة المخرجات (مبيعات) بضريبة المدخلات (مشتريات) لفترة محددة</p>
                </div>
                {rpt && <Button variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="w-4 h-4" />طباعة</Button>}
            </div>

            <Card className="p-4 border-zinc-200">
                <div className="flex items-end gap-3">
                    <div><label className="text-xs text-slate-600">من</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="vat-from" /></div>
                    <div><label className="text-xs text-slate-600">إلى</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="vat-to" /></div>
                    <Button onClick={load} disabled={loading} className="gap-1" data-testid="vat-refresh"><RefreshCw className="w-4 h-4" />{loading ? "..." : "حساب"}</Button>
                </div>
            </Card>

            {rpt && (
                <Card className="p-6 border-zinc-200">
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                            <h3 className="font-semibold text-emerald-800 mb-3">ضريبة المخرجات (المبيعات)</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>إجمالي المبيعات (بدون ضريبة):</span><span className="tabular-nums font-semibold">{fmt(rpt.sales_total_ex_vat)}</span></div>
                                <div className="flex justify-between text-lg pt-2 border-t border-emerald-300"><span>ضريبة مستحقة الدفع:</span><span className="tabular-nums font-bold text-emerald-700" data-testid="vat-output">{fmt(rpt.output_vat)}</span></div>
                            </div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h3 className="font-semibold text-blue-800 mb-3">ضريبة المدخلات (المشتريات)</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>إجمالي المشتريات (بدون ضريبة):</span><span className="tabular-nums font-semibold">{fmt(rpt.purchases_total_ex_vat)}</span></div>
                                <div className="flex justify-between text-lg pt-2 border-t border-blue-300"><span>ضريبة قابلة للخصم:</span><span className="tabular-nums font-bold text-blue-700" data-testid="vat-input">{fmt(rpt.input_vat)}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className={`p-6 rounded-lg text-center ${rpt.vat_payable >= 0 ? "bg-amber-100 border-2 border-amber-400" : "bg-emerald-100 border-2 border-emerald-400"}`}>
                        <div className="text-sm font-semibold text-slate-700 mb-2">{rpt.vat_payable >= 0 ? "المستحق لسلطة الضريبة" : "رصيد لصالحك (استرداد)"}</div>
                        <div className="text-3xl font-bold tabular-nums" data-testid="vat-payable">{fmt(Math.abs(rpt.vat_payable))}</div>
                    </div>
                </Card>
            )}
        </div>
    );
}
