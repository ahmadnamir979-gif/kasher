import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Expenses() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ category: "", amount: 0, notes: "" });
    const load = () => api.get("/expenses").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);
    const save = async () => {
        try { await api.post("/expenses", form); toast.success("تم الحفظ"); setOpen(false); setForm({ category: "", amount: 0, notes: "" }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const del = async (x) => { await api.delete(`/expenses/${x.id}`); load(); };
    const total = items.reduce((s, x) => s + x.amount, 0);
    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                <div><h3 className="font-semibold">المصاريف</h3><p className="text-xs text-slate-500">إجمالي: <span className="font-bold text-slate-900 tabular-nums">{fmt(total)}</span></p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-expense-btn"><Plus className="w-4 h-4" /> مصروف</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="bg-white">
                        <DialogHeader><DialogTitle>مصروف جديد</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            <div><Label>البند</Label><Input value={form.category} onChange={(e) => setForm(f => ({...f, category: e.target.value}))} placeholder="مثال: كهرباء، رواتب…" data-testid="exp-category" /></div>
                            <div><Label>المبلغ</Label><Input type="number" value={form.amount} onChange={(e) => setForm(f => ({...f, amount: +e.target.value}))} data-testid="exp-amount" /></div>
                            <div><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} /></div>
                        </div>
                        <DialogFooter><Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-expense-btn">حفظ</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600"><tr><th className="p-3">التاريخ</th><th className="p-3">البند</th><th className="p-3">المبلغ</th><th className="p-3">ملاحظات</th><th></th></tr></thead>
                <tbody>
                    {items.map(x => (
                        <tr key={x.id} className="border-b border-zinc-100">
                            <td className="p-3 tabular-nums text-slate-600">{x.created_at?.substring(0,16).replace("T"," ")}</td>
                            <td className="p-3 font-medium">{x.category}</td>
                            <td className="p-3 tabular-nums font-semibold text-rose-700">{fmt(x.amount)}</td>
                            <td className="p-3 text-slate-600">{x.notes}</td>
                            <td className="p-3"><Button size="sm" variant="outline" onClick={() => del(x)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد مصاريف</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}
