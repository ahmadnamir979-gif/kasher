import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, X } from "lucide-react";
import { toast } from "sonner";

const SOURCE_BADGE = {
    manual: { label: "يدوي", color: "bg-slate-100 text-slate-700" },
    sale: { label: "مبيعات", color: "bg-emerald-100 text-emerald-800" },
    purchase: { label: "مشتريات", color: "bg-blue-100 text-blue-800" },
    voucher: { label: "سند", color: "bg-purple-100 text-purple-800" },
    check_return: { label: "شيك مرتجع", color: "bg-rose-100 text-rose-800" },
};

export default function Journal() {
    const [rows, setRows] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        reference: "",
        lines: [
            { account_id: "", debit: 0, credit: 0, notes: "" },
            { account_id: "", debit: 0, credit: 0, notes: "" },
        ],
    });

    const load = async () => {
        try {
            const [j, a] = await Promise.all([api.get("/accounting/journal"), api.get("/accounting/accounts")]);
            setRows(j.data);
            setAccounts(a.data.filter(x => !x.is_group));
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { account_id: "", debit: 0, credit: 0, notes: "" }] }));
    const rmLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
    const updLine = (i, key, val) => setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, [key]: val } : l) }));

    const totalD = form.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalC = form.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const balanced = Math.abs(totalD - totalC) < 0.01 && totalD > 0;

    const submit = async () => {
        if (!balanced) return toast.error("القيد غير متوازن");
        try {
            await api.post("/accounting/journal", {
                date: form.date,
                description: form.description || "قيد يومية",
                reference: form.reference,
                lines: form.lines.map(l => ({ ...l, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })).filter(l => l.account_id && (l.debit > 0 || l.credit > 0)),
                source: "manual",
            });
            toast.success("تم إضافة القيد");
            setOpen(false);
            setForm({
                date: new Date().toISOString().slice(0, 10),
                description: "",
                reference: "",
                lines: [{ account_id: "", debit: 0, credit: 0, notes: "" }, { account_id: "", debit: 0, credit: 0, notes: "" }],
            });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const remove = async (id) => {
        if (!window.confirm("حذف القيد؟")) return;
        try { await api.delete(`/accounting/journal/${id}`); toast.success("تم الحذف"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">اليومية العامة</h2>
                    <p className="text-sm text-slate-500">{rows.length} قيد — القيود التلقائية تُنشأ من المبيعات والمشتريات والسندات</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="journal-add-btn"><Plus className="w-4 h-4" />قيد جديد</Button>
            </div>

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">البيان</th>
                            <th className="p-3">المرجع</th>
                            <th className="p-3">المصدر</th>
                            <th className="p-3">مدين</th>
                            <th className="p-3">دائن</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(e => (
                            <tr key={e.id} className="border-b border-zinc-100" data-testid={`je-row-${e.number}`}>
                                <td className="p-3 tabular-nums font-mono">{e.number}</td>
                                <td className="p-3 tabular-nums">{e.date}</td>
                                <td className="p-3">
                                    <div className="font-medium">{e.description}</div>
                                    <div className="text-xs text-slate-500 mt-1">{e.lines.map((l, i) => <span key={i} className="ml-2">{l.account_name}: {l.debit ? `م ${fmt(l.debit)}` : `د ${fmt(l.credit)}`}</span>)}</div>
                                </td>
                                <td className="p-3 tabular-nums text-slate-600">{e.reference || "-"}</td>
                                <td className="p-3"><Badge className={SOURCE_BADGE[e.source]?.color || "bg-slate-100"}>{SOURCE_BADGE[e.source]?.label || e.source}</Badge></td>
                                <td className="p-3 tabular-nums font-semibold">{fmt(e.total_debit)}</td>
                                <td className="p-3 tabular-nums font-semibold">{fmt(e.total_credit)}</td>
                                <td className="p-3">
                                    {(e.source === "manual" || e.source === "voucher") && (
                                        <Button size="sm" variant="ghost" onClick={() => remove(e.id)} className="text-rose-600" data-testid={`je-delete-${e.number}`}><Trash2 className="w-4 h-4" /></Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader><DialogTitle>قيد يومية جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-slate-600">التاريخ</label>
                                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} data-testid="je-date" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-slate-600">البيان</label>
                                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف القيد" data-testid="je-desc" />
                            </div>
                        </div>
                        <Input placeholder="مرجع (اختياري)" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} data-testid="je-ref" />
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 text-xs">
                                    <tr><th className="p-2">الحساب</th><th className="p-2 w-32">مدين</th><th className="p-2 w-32">دائن</th><th className="p-2">ملاحظات</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {form.lines.map((ln, i) => (
                                        <tr key={i} className="border-b">
                                            <td className="p-2">
                                                <Select value={ln.account_id} onValueChange={v => updLine(i, "account_id", v)}>
                                                    <SelectTrigger data-testid={`je-line-${i}-acc`}><SelectValue placeholder="اختر حساباً" /></SelectTrigger>
                                                    <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </td>
                                            <td className="p-2"><Input type="number" step="0.01" value={ln.debit} onChange={e => updLine(i, "debit", e.target.value)} data-testid={`je-line-${i}-dr`} /></td>
                                            <td className="p-2"><Input type="number" step="0.01" value={ln.credit} onChange={e => updLine(i, "credit", e.target.value)} data-testid={`je-line-${i}-cr`} /></td>
                                            <td className="p-2"><Input value={ln.notes} onChange={e => updLine(i, "notes", e.target.value)} /></td>
                                            <td className="p-2"><Button size="sm" variant="ghost" onClick={() => rmLine(i)}><X className="w-4 h-4" /></Button></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-zinc-50 font-semibold">
                                    <tr>
                                        <td className="p-2 text-left">الإجمالي</td>
                                        <td className="p-2 tabular-nums">{fmt(totalD)}</td>
                                        <td className="p-2 tabular-nums">{fmt(totalC)}</td>
                                        <td colSpan="2" className="p-2">
                                            {balanced ? <Badge className="bg-emerald-100 text-emerald-800">متوازن</Badge> : <Badge className="bg-rose-100 text-rose-800">فرق: {fmt(totalD - totalC)}</Badge>}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <Button variant="outline" onClick={addLine} className="w-full gap-1"><Plus className="w-4 h-4" />إضافة سطر</Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                        <Button onClick={submit} disabled={!balanced} data-testid="je-save-btn">حفظ القيد</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
