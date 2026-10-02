import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import SearchSelect from "@/components/SearchSelect";

const ROLE_AR = { cashier: "كاشير", accountant: "محاسب", manager: "مدير" };

export default function Employees() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "cashier", is_active: true });
    const load = () => api.get("/employees").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);
    const save = async () => {
        try { await api.post("/employees", form); toast.success("تم إضافة الموظف"); setOpen(false); setForm({ name: "", email: "", password: "", role: "cashier", is_active: true }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const del = async (x) => { if (!window.confirm(`حذف ${x.name}؟`)) return; await api.delete(`/employees/${x.id}`); load(); };
    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                <div><h3 className="font-semibold">الموظفين</h3><p className="text-xs text-slate-500">{items.length} موظف</p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-employee-btn"><Plus className="w-4 h-4" /> موظف</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="bg-white">
                        <DialogHeader><DialogTitle>موظف جديد</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                            <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} data-testid="emp-name" /></div>
                            <div><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} data-testid="emp-email" /></div>
                            <div><Label>كلمة المرور</Label><Input type="password" value={form.password} onChange={(e) => setForm(f => ({...f, password: e.target.value}))} data-testid="emp-password" /></div>
                            <div><Label>الدور</Label>
                                <SearchSelect value={form.role} onChange={(v) => setForm(f => ({...f, role: v}))}
                                    options={[{value:"cashier",label:"كاشير"},{value:"accountant",label:"محاسب"},{value:"manager",label:"مدير"}]}
                                    testid="emp-role" className="mt-1" />
                            </div>
                        </div>
                        <DialogFooter><Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-employee-btn">حفظ</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600"><tr><th className="p-3">الاسم</th><th className="p-3">البريد</th><th className="p-3">الدور</th><th className="p-3">الحالة</th><th className="p-3"></th></tr></thead>
                <tbody>
                    {items.map(x => (
                        <tr key={x.id} className="border-b border-zinc-100">
                            <td className="p-3 font-medium">{x.name}</td>
                            <td className="p-3 tabular-nums text-slate-600">{x.email}</td>
                            <td className="p-3"><Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">{ROLE_AR[x.role]}</Badge></td>
                            <td className="p-3">{x.is_active ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">نشط</Badge> : <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">موقوف</Badge>}</td>
                            <td className="p-3"><Button size="sm" variant="outline" onClick={() => del(x)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا يوجد موظفين</td></tr>}
                </tbody>
            </table>
        </Card>
    );
}
