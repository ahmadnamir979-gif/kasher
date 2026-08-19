import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Warehouse as WhIcon, Star } from "lucide-react";
import { toast } from "sonner";

export default function Warehouses() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", location: "", is_default: false });
    const load = () => api.get("/warehouses").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);
    const save = async () => {
        try { await api.post("/warehouses", form); toast.success("تمّ الحفظ"); setOpen(false); setForm({ name: "", location: "", is_default: false }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const setDefault = async (w) => {
        try { await api.patch(`/warehouses/${w.id}`, { name: w.name, location: w.location || "", is_default: true }); toast.success("تمّ التعيين كافتراضي"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const del = async (w) => {
        if (!window.confirm(`حذف مخزن ${w.name}؟`)) return;
        try { await api.delete(`/warehouses/${w.id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                <div><h3 className="font-semibold">المخازن</h3><p className="text-xs text-slate-500">{items.length} مخزن</p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-warehouse-btn"><Plus className="w-4 h-4" /> إضافة مخزن</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="bg-white">
                        <DialogHeader><DialogTitle>مخزن جديد</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} data-testid="wh-name-input" /></div>
                            <div><Label>الموقع</Label><Input value={form.location} onChange={(e) => setForm(f => ({...f, location: e.target.value}))} placeholder="مثل: المستودع الخلفي، فرع الوسط..." /></div>
                        </div>
                        <DialogFooter><Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-warehouse-btn">حفظ</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600"><tr><th className="p-3">الاسم</th><th className="p-3">الموقع</th><th className="p-3">الحالة</th><th className="p-3"></th></tr></thead>
                <tbody>
                    {items.map(w => (
                        <tr key={w.id} className="border-b border-zinc-100">
                            <td className="p-3 font-medium flex items-center gap-2"><WhIcon className="w-4 h-4 text-slate-400" /> {w.name}</td>
                            <td className="p-3 text-slate-600">{w.location || "—"}</td>
                            <td className="p-3">{w.is_default ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1"><Star className="w-3 h-3" /> افتراضي</Badge> : <Badge variant="outline">فرعي</Badge>}</td>
                            <td className="p-3">
                                <div className="flex gap-1.5">
                                    {!w.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(w)}>تعيين افتراضي</Button>}
                                    {!w.is_default && <Button size="sm" variant="outline" onClick={() => del(w)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
}
