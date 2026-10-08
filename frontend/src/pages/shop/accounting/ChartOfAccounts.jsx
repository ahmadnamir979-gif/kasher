import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Book } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS = {
    asset: { label: "أصول", color: "bg-emerald-100 text-emerald-800" },
    liability: { label: "خصوم", color: "bg-rose-100 text-rose-800" },
    equity: { label: "حقوق ملكية", color: "bg-purple-100 text-purple-800" },
    revenue: { label: "إيرادات", color: "bg-blue-100 text-blue-800" },
    expense: { label: "مصروفات", color: "bg-orange-100 text-orange-800" },
};

export default function ChartOfAccounts() {
    const [rows, setRows] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ code: "", name: "", type: "asset", parent_id: "", is_group: false });
    const [filter, setFilter] = useState("");

    const load = async () => {
        try { const r = await api.get("/accounting/accounts"); setRows(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const create = async () => {
        try {
            await api.post("/accounting/accounts", { ...form, parent_id: form.parent_id || null });
            toast.success("تمّت الإضافة");
            setOpen(false);
            setForm({ code: "", name: "", type: "asset", parent_id: "", is_group: false });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("تأكيد الحذف؟")) return;
        try { await api.delete(`/accounting/accounts/${id}`); toast.success("تمّ الحذف"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const filtered = rows.filter(r => !filter || r.name.includes(filter) || r.code.includes(filter));
    const groups = rows.filter(r => r.is_group);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Book className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">فهرس الحسابات</h2>
                    <p className="text-sm text-slate-500">{rows.length} حساب — الحسابات النظامية مثبّتة تلقائياً لكل محل</p>
                </div>
                <Input placeholder="بحث..." value={filter} onChange={e => setFilter(e.target.value)} className="max-w-xs" data-testid="coa-search" />
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="coa-add-btn"><Plus className="w-4 h-4" />حساب جديد</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-3">الرقم</th>
                            <th className="p-3">الاسم</th>
                            <th className="p-3">النوع</th>
                            <th className="p-3">الرصيد</th>
                            <th className="p-3">النظام</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(r => (
                            <tr key={r.id} className={`border-b border-zinc-100 ${r.is_group ? "bg-zinc-50 font-semibold" : ""}`} data-testid={`account-row-${r.code}`}>
                                <td className="p-3 tabular-nums font-mono">{r.code}</td>
                                <td className="p-3" style={{ paddingRight: `${(r.code.length - 1) * 12}px` }}>{r.name}</td>
                                <td className="p-3"><Badge className={TYPE_LABELS[r.type]?.color}>{TYPE_LABELS[r.type]?.label}</Badge></td>
                                <td className="p-3 tabular-nums">{fmt(r.balance)}</td>
                                <td className="p-3">{r.is_system ? <Badge variant="outline">نظام</Badge> : <Badge variant="outline" className="border-emerald-300 text-emerald-700">مخصّص</Badge>}</td>
                                <td className="p-3 text-left">
                                    {!r.is_system && <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-rose-600" data-testid={`account-delete-${r.code}`}><Trash2 className="w-4 h-4" /></Button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>إضافة حساب جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="رقم الحساب (مثلاً 5204)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} data-testid="coa-code-input" />
                        <Input placeholder="اسم الحساب" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="coa-name-input" />
                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                            <SelectTrigger data-testid="coa-type-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={form.parent_id || "none"} onValueChange={v => setForm(f => ({ ...f, parent_id: v === "none" ? "" : v }))}>
                            <SelectTrigger data-testid="coa-parent-select"><SelectValue placeholder="حساب أب (اختياري)" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">بدون حساب أب</SelectItem>
                                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.code} - {g.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.is_group} onChange={e => setForm(f => ({ ...f, is_group: e.target.checked }))} data-testid="coa-isgroup-cb" />
                            <span>هذا حساب رئيسي (مجموعة)</span>
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                        <Button onClick={create} data-testid="coa-save-btn">حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
