import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function CrudPage({ endpoint, title, singular, extraFields = [] }) {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", opening_balance: 0 });
    const load = () => api.get(`/${endpoint}`).then(r => setItems(r.data));
    useEffect(() => { load(); }, [endpoint]);
    const save = async () => {
        try { await api.post(`/${endpoint}`, form); toast.success("تم الحفظ"); setOpen(false); setForm({ name: "", phone: "", email: "", address: "", opening_balance: 0 }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const del = async (x) => { if (!window.confirm(`حذف ${x.name}؟`)) return; await api.delete(`/${endpoint}/${x.id}`); load(); };
    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                <div><h3 className="font-semibold">{title}</h3><p className="text-xs text-slate-500">{items.length} سجل</p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid={`add-${endpoint}-btn`}><Plus className="w-4 h-4" /> إضافة</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="bg-white">
                        <DialogHeader><DialogTitle>{singular} جديد</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            {[["الاسم","name"],["الهاتف","phone"],["البريد","email"],["العنوان","address"]].map(([l,k]) => (
                                <div key={k}><Label>{l}</Label><Input value={form[k]} onChange={(e) => setForm(f => ({...f, [k]: e.target.value}))} data-testid={`${endpoint}-${k}-input`} /></div>
                            ))}
                            <div><Label>رصيد افتتاحي</Label><Input type="number" value={form.opening_balance} onChange={(e) => setForm(f => ({...f, opening_balance: +e.target.value}))} /></div>
                        </div>
                        <DialogFooter><Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid={`save-${endpoint}-btn`}>حفظ</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600"><tr><th className="p-3">الاسم</th><th className="p-3">الهاتف</th><th className="p-3">البريد</th><th className="p-3">الرصيد</th><th className="p-3"></th></tr></thead>
                <tbody>
                    {items.map(x => (
                        <tr key={x.id} className="border-b border-zinc-100">
                            <td className="p-3 font-medium">{x.name}</td>
                            <td className="p-3 tabular-nums text-slate-600">{x.phone || "—"}</td>
                            <td className="p-3 text-slate-600">{x.email || "—"}</td>
                            <td className={`p-3 tabular-nums font-semibold ${x.balance > 0 ? "text-emerald-700" : x.balance < 0 ? "text-rose-700" : ""}`}>{fmt(x.balance || 0)}</td>
                            <td className="p-3"><Button size="sm" variant="outline" onClick={() => del(x)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}
