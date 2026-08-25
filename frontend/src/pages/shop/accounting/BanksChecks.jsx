import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Landmark, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const STATUS_META = {
    pending: { label: "معلق", color: "bg-amber-100 text-amber-800" },
    deposited: { label: "مودَع", color: "bg-blue-100 text-blue-800" },
    cashed: { label: "مصروف", color: "bg-emerald-100 text-emerald-800" },
    cleared: { label: "مقبوض", color: "bg-emerald-100 text-emerald-800" },
    returned: { label: "مرتجع", color: "bg-rose-100 text-rose-800" },
};

export default function BanksChecks() {
    const [banks, setBanks] = useState([]);
    const [checks, setChecks] = useState([]);
    const [openBank, setOpenBank] = useState(false);
    const [openCheck, setOpenCheck] = useState(false);
    const [bankForm, setBankForm] = useState({ name: "", account_number: "", iban: "", currency: "ILS", opening_balance: 0 });
    const [checkForm, setCheckForm] = useState({
        kind: "received", check_number: "", date: new Date().toISOString().slice(0, 10),
        due_date: new Date().toISOString().slice(0, 10), amount: 0, party_name: "", bank_name: "", notes: "",
    });

    const load = async () => {
        try {
            const [b, c] = await Promise.all([api.get("/banks"), api.get("/checks")]);
            setBanks(b.data);
            setChecks(c.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const createBank = async () => {
        try {
            await api.post("/banks", { ...bankForm, opening_balance: Number(bankForm.opening_balance) });
            toast.success("تم إضافة البنك");
            setOpenBank(false);
            setBankForm({ name: "", account_number: "", iban: "", currency: "ILS", opening_balance: 0 });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const createCheck = async () => {
        try {
            await api.post("/checks", { ...checkForm, amount: Number(checkForm.amount) });
            toast.success("تم إضافة الشيك");
            setOpenCheck(false);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const setStatus = async (id, status) => {
        try {
            await api.patch(`/checks/${id}/status`, { status });
            toast.success("تم التحديث");
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const removeBank = async (id) => {
        if (!window.confirm("حذف البنك؟")) return;
        try { await api.delete(`/banks/${id}`); toast.success("تم الحذف"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const removeCheck = async (id) => {
        if (!window.confirm("حذف الشيك؟")) return;
        try { await api.delete(`/checks/${id}`); toast.success("تم الحذف"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Landmark className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">البنوك والشيكات</h2>
                    <p className="text-sm text-slate-500">{banks.length} حساب بنكي • {checks.length} شيك</p>
                </div>
            </div>

            <Tabs defaultValue="banks">
                <TabsList>
                    <TabsTrigger value="banks" data-testid="tab-banks">البنوك</TabsTrigger>
                    <TabsTrigger value="received" data-testid="tab-received">شيكات مستلمة</TabsTrigger>
                    <TabsTrigger value="issued" data-testid="tab-issued">شيكات صادرة</TabsTrigger>
                </TabsList>
                <TabsContent value="banks">
                    <div className="flex justify-end mb-2">
                        <Button onClick={() => setOpenBank(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="bank-add-btn"><Plus className="w-4 h-4" />بنك جديد</Button>
                    </div>
                    <Card className="overflow-x-auto border-zinc-200">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                                <tr><th className="p-3">الاسم</th><th className="p-3">رقم الحساب</th><th className="p-3">IBAN</th><th className="p-3">العملة</th><th className="p-3">الرصيد الافتتاحي</th><th className="p-3"></th></tr>
                            </thead>
                            <tbody>
                                {banks.map(b => (
                                    <tr key={b.id} className="border-b border-zinc-100" data-testid={`bank-row-${b.id}`}>
                                        <td className="p-3 font-semibold">{b.name}</td>
                                        <td className="p-3 tabular-nums">{b.account_number || "-"}</td>
                                        <td className="p-3 tabular-nums text-xs">{b.iban || "-"}</td>
                                        <td className="p-3"><Badge variant="outline">{b.currency}</Badge></td>
                                        <td className="p-3 tabular-nums">{fmt(b.opening_balance)}</td>
                                        <td className="p-3"><Button size="sm" variant="ghost" onClick={() => removeBank(b.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button></td>
                                    </tr>
                                ))}
                                {banks.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400">لا توجد بنوك</td></tr>}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                {["received", "issued"].map(kind => (
                    <TabsContent key={kind} value={kind}>
                        <div className="flex justify-end mb-2">
                            <Button onClick={() => { setCheckForm(f => ({ ...f, kind })); setOpenCheck(true); }} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid={`check-add-${kind}`}><Plus className="w-4 h-4" />شيك {kind === "received" ? "وارد" : "صادر"}</Button>
                        </div>
                        <Card className="overflow-x-auto border-zinc-200">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                                    <tr><th className="p-3">رقم الشيك</th><th className="p-3">التاريخ</th><th className="p-3">الاستحقاق</th><th className="p-3">الطرف</th><th className="p-3">البنك</th><th className="p-3">المبلغ</th><th className="p-3">الحالة</th><th className="p-3"></th></tr>
                                </thead>
                                <tbody>
                                    {checks.filter(c => c.kind === kind).map(c => (
                                        <tr key={c.id} className="border-b border-zinc-100" data-testid={`check-row-${c.id}`}>
                                            <td className="p-3 font-mono">{c.check_number}</td>
                                            <td className="p-3 tabular-nums">{c.date}</td>
                                            <td className="p-3 tabular-nums">{c.due_date}</td>
                                            <td className="p-3">{c.party_name}</td>
                                            <td className="p-3 text-slate-600">{c.bank_name || "-"}</td>
                                            <td className="p-3 tabular-nums font-semibold">{fmt(c.amount)}</td>
                                            <td className="p-3"><Badge className={STATUS_META[c.status]?.color}>{STATUS_META[c.status]?.label}</Badge></td>
                                            <td className="p-3">
                                                <div className="flex gap-1">
                                                    {c.status === "pending" && kind === "received" && (
                                                        <>
                                                            <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "cleared")} className="text-emerald-600 gap-1" data-testid={`check-clear-${c.id}`}><CheckCircle2 className="w-3 h-3" />قُبض</Button>
                                                            <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "returned")} className="text-rose-600 gap-1" data-testid={`check-return-${c.id}`}><RotateCcw className="w-3 h-3" />مرتجع</Button>
                                                        </>
                                                    )}
                                                    {c.status === "pending" && kind === "issued" && (
                                                        <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "cashed")} className="text-emerald-600 gap-1" data-testid={`check-cash-${c.id}`}><CheckCircle2 className="w-3 h-3" />صُرف</Button>
                                                    )}
                                                    <Button size="sm" variant="ghost" onClick={() => removeCheck(c.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {checks.filter(c => c.kind === kind).length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-400">لا توجد شيكات</td></tr>}
                                </tbody>
                            </table>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>

            <Dialog open={openBank} onOpenChange={setOpenBank}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>بنك جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="اسم البنك" value={bankForm.name} onChange={e => setBankForm(f => ({ ...f, name: e.target.value }))} data-testid="bank-name" />
                        <Input placeholder="رقم الحساب" value={bankForm.account_number} onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} />
                        <Input placeholder="IBAN" value={bankForm.iban} onChange={e => setBankForm(f => ({ ...f, iban: e.target.value }))} />
                        <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="العملة" value={bankForm.currency} onChange={e => setBankForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} />
                            <Input type="number" placeholder="رصيد افتتاحي" value={bankForm.opening_balance} onChange={e => setBankForm(f => ({ ...f, opening_balance: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpenBank(false)}>إلغاء</Button><Button onClick={createBank} data-testid="bank-save-btn">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={openCheck} onOpenChange={setOpenCheck}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>شيك جديد ({checkForm.kind === "received" ? "وارد" : "صادر"})</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="رقم الشيك" value={checkForm.check_number} onChange={e => setCheckForm(f => ({ ...f, check_number: e.target.value }))} data-testid="check-no" />
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs">تاريخ الإصدار</label><Input type="date" value={checkForm.date} onChange={e => setCheckForm(f => ({ ...f, date: e.target.value }))} /></div>
                            <div><label className="text-xs">الاستحقاق</label><Input type="date" value={checkForm.due_date} onChange={e => setCheckForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                        </div>
                        <Input type="number" step="0.01" placeholder="المبلغ" value={checkForm.amount} onChange={e => setCheckForm(f => ({ ...f, amount: e.target.value }))} data-testid="check-amount" />
                        <Input placeholder="اسم الطرف" value={checkForm.party_name} onChange={e => setCheckForm(f => ({ ...f, party_name: e.target.value }))} data-testid="check-party" />
                        <Input placeholder="اسم البنك" value={checkForm.bank_name} onChange={e => setCheckForm(f => ({ ...f, bank_name: e.target.value }))} />
                        <Input placeholder="ملاحظات" value={checkForm.notes} onChange={e => setCheckForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpenCheck(false)}>إلغاء</Button><Button onClick={createCheck} data-testid="check-save-btn">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
