import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";

export default function CostCenters() {
    const [rows, setRows] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", code: "", notes: "" });

    const load = async () => {
        try { const r = await api.get("/cost-centers"); setRows(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const submit = async () => {
        try { await api.post("/cost-centers", form); toast.success("تم"); setOpen(false); setForm({ name: "", code: "", notes: "" }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف مركز التكلفة؟")) return;
        try { await api.delete(`/cost-centers/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">مراكز التكلفة</h2>
                    <p className="text-sm text-slate-500">{rows.length} مركز تكلفة — لتوزيع المصاريف على أقسام/مشاريع</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="cc-add-btn"><Plus className="w-4 h-4" />مركز جديد</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600"><tr><th className="p-3">الرمز</th><th className="p-3">الاسم</th><th className="p-3">ملاحظات</th><th className="p-3"></th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-zinc-100" data-testid={`cc-row-${r.id}`}>
                                <td className="p-3 font-mono">{r.code || "-"}</td>
                                <td className="p-3 font-semibold">{r.name}</td>
                                <td className="p-3 text-slate-600">{r.notes || "-"}</td>
                                <td className="p-3"><Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button></td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">لا توجد مراكز تكلفة</td></tr>}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>مركز تكلفة جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="اسم المركز" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="cc-name" />
                        <Input placeholder="الرمز (اختياري)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
                        <Input placeholder="ملاحظات" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} data-testid="cc-save">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
