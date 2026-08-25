import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Lock, Unlock, Plus } from "lucide-react";
import { toast } from "sonner";

export default function ClosedPeriods() {
    const [rows, setRows] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ end_date: new Date().toISOString().slice(0, 10), notes: "" });

    const load = async () => {
        try { const r = await api.get("/accounting/closed-periods"); setRows(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const submit = async () => {
        try { await api.post("/accounting/closed-periods", form); toast.success("تم إغلاق الفترة"); setOpen(false); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const reopen = async (id) => {
        if (!window.confirm("إعادة فتح الفترة؟ سيسمح بالتعديل مجدداً.")) return;
        try { await api.delete(`/accounting/closed-periods/${id}`); toast.success("تم فتح الفترة"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">الفترات المالية المغلقة</h2>
                    <p className="text-sm text-slate-500">إغلاق الفترات لمنع أي تعديل على قيود سابقة (نهاية سنة، تدقيق، ...)</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-rose-600 hover:bg-rose-700" data-testid="period-close-btn"><Lock className="w-4 h-4" />إغلاق فترة</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                        <tr><th className="p-3">مغلقة حتى</th><th className="p-3">ملاحظات</th><th className="p-3">أُغلقت في</th><th className="p-3"></th></tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-zinc-100" data-testid={`period-row-${r.id}`}>
                                <td className="p-3 tabular-nums font-semibold">{r.end_date}</td>
                                <td className="p-3 text-slate-600">{r.notes || "-"}</td>
                                <td className="p-3 tabular-nums text-xs">{r.closed_at?.slice(0, 16).replace("T", " ")}</td>
                                <td className="p-3"><Button size="sm" variant="outline" onClick={() => reopen(r.id)} className="gap-1 text-emerald-600" data-testid={`period-reopen-${r.id}`}><Unlock className="w-3 h-3" />إعادة فتح</Button></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">لا توجد فترات مغلقة</td></tr>}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>إغلاق فترة مالية</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><label className="text-xs">إغلاق حتى تاريخ (شامل)</label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} data-testid="period-date" /></div>
                        <Input placeholder="ملاحظات (اختياري)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                        <div className="text-xs bg-amber-50 border border-amber-300 rounded p-3 text-amber-800">تحذير: لن يمكن إضافة/حذف أي قيد أو سند بتاريخ أقل أو يساوي هذا التاريخ.</div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} className="bg-rose-600 hover:bg-rose-700" data-testid="period-save">إغلاق الفترة</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
