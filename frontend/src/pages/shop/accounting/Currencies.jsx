import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, DollarSign, Pencil } from "lucide-react";
import { toast } from "sonner";

export default function Currencies() {
    const [rows, setRows] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ code: "", name: "", symbol: "", rate: 1 });

    const load = async () => {
        try { const r = await api.get("/currencies"); setRows(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const submit = async () => {
        try {
            const payload = { ...form, code: form.code.toUpperCase(), rate: Number(form.rate) };
            if (editing) await api.patch(`/currencies/${editing}`, payload);
            else await api.post("/currencies", payload);
            toast.success("تم");
            setOpen(false); setEditing(null); setForm({ code: "", name: "", symbol: "", rate: 1 });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const startEdit = (r) => {
        setEditing(r.id);
        setForm({ code: r.code, name: r.name, symbol: r.symbol || "", rate: r.rate });
        setOpen(true);
    };

    const remove = async (id) => {
        if (!window.confirm("حذف العملة؟")) return;
        try { await api.delete(`/currencies/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">العملات وأسعار الصرف</h2>
                    <p className="text-sm text-slate-500">{rows.length} عملة — الأسعار تُستخدم لتحويل المعاملات إلى العملة الأساسية</p>
                </div>
                <Button onClick={() => { setEditing(null); setForm({ code: "", name: "", symbol: "", rate: 1 }); setOpen(true); }} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="curr-add-btn"><Plus className="w-4 h-4" />عملة جديدة</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600"><tr><th className="p-3">الرمز</th><th className="p-3">الاسم</th><th className="p-3">الشعار</th><th className="p-3">سعر الصرف</th><th className="p-3">الأساسية</th><th className="p-3"></th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-b border-zinc-100" data-testid={`curr-row-${r.code}`}>
                                <td className="p-3 font-mono font-semibold">{r.code}</td>
                                <td className="p-3">{r.name}</td>
                                <td className="p-3">{r.symbol}</td>
                                <td className="p-3 tabular-nums">{r.rate}</td>
                                <td className="p-3">{r.is_base && <Badge className="bg-emerald-100 text-emerald-800">أساسية</Badge>}</td>
                                <td className="p-3 text-left">
                                    <div className="flex gap-1 justify-end">
                                        <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Pencil className="w-4 h-4" /></Button>
                                        {!r.is_base && <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "تعديل عملة" : "عملة جديدة"}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="الرمز (مثلاً USD)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} data-testid="curr-code" />
                        <Input placeholder="الاسم" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="curr-name" />
                        <Input placeholder="الشعار (مثلاً $)" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} />
                        <div><label className="text-xs">سعر الصرف (كم من العملة الأساسية = 1 من هذه العملة)</label><Input type="number" step="0.0001" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} data-testid="curr-rate" /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} data-testid="curr-save">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
