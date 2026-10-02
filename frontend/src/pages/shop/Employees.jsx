import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, HandCoins, Phone, Briefcase, CalendarDays, Wallet } from "lucide-react";
import { toast } from "sonner";
import SearchSelect from "@/components/SearchSelect";

const ROLE_AR = { cashier: "كاشير", accountant: "محاسب", manager: "مدير" };
const ST_AR = { monthly: "شهري", daily: "يومي", hourly: "بالساعة" };
const EMPTY_FORM = { name: "", email: "", password: "", role: "cashier", phone: "", position: "", hire_date: "", salary_type: "monthly", salary_amount: 0, is_active: true };

export default function Employees() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null); // employee being edited
    const [form, setForm] = useState(EMPTY_FORM);
    const [loanOpenFor, setLoanOpenFor] = useState(null); // employee object
    const [loans, setLoans] = useState({ rows: [], total: 0 });
    const [loanForm, setLoanForm] = useState({ amount: 0, reason: "", date: "" });

    const load = () => api.get("/employees").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);

    const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
    const openEdit = (emp) => {
        setEditing(emp);
        setForm({
            name: emp.name || "", email: emp.email || "", password: "",
            role: emp.role || "cashier", phone: emp.phone || "", position: emp.position || "",
            hire_date: emp.hire_date || "", salary_type: emp.salary_type || "monthly",
            salary_amount: emp.salary_amount || 0, is_active: emp.is_active !== false,
        });
        setOpen(true);
    };

    const save = async () => {
        try {
            if (editing) {
                const payload = { ...form };
                if (!payload.password) delete payload.password;
                delete payload.email; // email cannot change
                await api.patch(`/employees/${editing.id}`, payload);
                toast.success("تمّ تحديث بيانات الموظف");
            } else {
                await api.post("/employees", form);
                toast.success("تمّ إضافة الموظف");
            }
            setOpen(false); setEditing(null); setForm(EMPTY_FORM); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const del = async (x) => {
        if (!window.confirm(`حذف الموظف ${x.name}؟ سيتم حذف كل سلفه أيضاً.`)) return;
        try { await api.delete(`/employees/${x.id}`); load(); toast.success("تمّ الحذف"); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const openLoans = async (emp) => {
        setLoanOpenFor(emp);
        setLoanForm({ amount: 0, reason: "", date: new Date().toISOString().slice(0, 10) });
        const { data } = await api.get(`/employees/${emp.id}/loans`);
        setLoans(data);
    };

    const saveLoan = async () => {
        try {
            if (!(+loanForm.amount)) return toast.error("أدخل مبلغ السلفة");
            await api.post(`/employees/${loanOpenFor.id}/loans`, loanForm);
            toast.success("تمّ إضافة السلفة");
            const { data } = await api.get(`/employees/${loanOpenFor.id}/loans`);
            setLoans(data);
            setLoanForm({ amount: 0, reason: "", date: new Date().toISOString().slice(0, 10) });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const delLoan = async (lid) => {
        if (!window.confirm("حذف هذه السلفة؟")) return;
        await api.delete(`/employees/${loanOpenFor.id}/loans/${lid}`);
        const { data } = await api.get(`/employees/${loanOpenFor.id}/loans`);
        setLoans(data);
    };

    return (
        <>
            <Card className="border-zinc-200">
                <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                    <div><h3 className="font-semibold">الموظفين</h3><p className="text-xs text-slate-500">{items.length} موظف</p></div>
                    <Button onClick={openAdd} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="add-employee-btn"><Plus className="w-4 h-4" /> موظف جديد</Button>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-3">الاسم</th><th className="p-3">الهاتف</th><th className="p-3">المنصب</th>
                            <th className="p-3">تاريخ التعيين</th><th className="p-3">نوع الراتب</th><th className="p-3">المبلغ</th>
                            <th className="p-3">الدور</th><th className="p-3">الحالة</th><th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(x => (
                            <tr key={x.id} className="border-b border-zinc-100">
                                <td className="p-3 font-medium">{x.name}<div className="text-[11px] text-slate-500 tabular-nums">{x.email}</div></td>
                                <td className="p-3 tabular-nums text-slate-700">{x.phone || "—"}</td>
                                <td className="p-3 text-slate-700">{x.position || "—"}</td>
                                <td className="p-3 tabular-nums text-slate-500">{x.hire_date || "—"}</td>
                                <td className="p-3"><Badge className="bg-indigo-100 text-indigo-800">{ST_AR[x.salary_type] || "—"}</Badge></td>
                                <td className="p-3 tabular-nums font-semibold">{fmt(x.salary_amount || 0)}</td>
                                <td className="p-3"><Badge className="bg-slate-100 text-slate-800">{ROLE_AR[x.role]}</Badge></td>
                                <td className="p-3">{x.is_active ? <Badge className="bg-emerald-100 text-emerald-800">نشط</Badge> : <Badge className="bg-rose-100 text-rose-800">موقوف</Badge>}</td>
                                <td className="p-3">
                                    <div className="flex gap-1.5">
                                        <Button size="sm" variant="outline" onClick={() => openEdit(x)} data-testid={`edit-emp-${x.id}`}><Pencil className="w-3.5 h-3.5 text-slate-700" /></Button>
                                        <Button size="sm" variant="outline" onClick={() => openLoans(x)} className="text-amber-700" data-testid={`loans-${x.id}`}><HandCoins className="w-3.5 h-3.5" /> سلف</Button>
                                        <Button size="sm" variant="outline" onClick={() => del(x)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">لا يوجد موظفين — ابدأ بإضافة موظف جديد</td></tr>}
                    </tbody>
                </table>
            </Card>

            {/* Add / Edit Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent dir="rtl" className="bg-white max-w-2xl">
                    <DialogHeader><DialogTitle>{editing ? `تعديل بيانات الموظف — ${editing.name}` : "موظف جديد"}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                        <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} data-testid="emp-name" /></div>
                        <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm(f => ({...f, phone: e.target.value}))} data-testid="emp-phone" placeholder="05xxxxxxxx" /></div>
                        <div><Label>المنصب</Label><Input value={form.position} onChange={(e) => setForm(f => ({...f, position: e.target.value}))} data-testid="emp-position" placeholder="مثال: كاشير أول، مسؤول مستودع..." /></div>
                        <div><Label>تاريخ التعيين</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm(f => ({...f, hire_date: e.target.value}))} data-testid="emp-hire" /></div>
                        <div><Label>نوع الراتب *</Label>
                            <SearchSelect value={form.salary_type} onChange={(v) => setForm(f => ({...f, salary_type: v}))}
                                options={[{value:"monthly",label:"شهري"},{value:"daily",label:"يومي"},{value:"hourly",label:"بالساعة"}]}
                                testid="emp-salary-type" className="mt-1" />
                        </div>
                        <div>
                            <Label>
                                {form.salary_type === "monthly" ? "الراتب الشهري" :
                                 form.salary_type === "daily" ? "الأجر اليومي" : "الأجر بالساعة"} *
                            </Label>
                            <Input type="number" value={form.salary_amount} onChange={(e) => setForm(f => ({...f, salary_amount: +e.target.value}))} data-testid="emp-salary-amount" />
                        </div>
                        <div><Label>الدور في النظام</Label>
                            <SearchSelect value={form.role} onChange={(v) => setForm(f => ({...f, role: v}))}
                                options={[{value:"cashier",label:"كاشير"},{value:"accountant",label:"محاسب"},{value:"manager",label:"مدير"}]}
                                testid="emp-role" className="mt-1" />
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm(f => ({...f, is_active: e.target.checked}))} />
                            <Label htmlFor="is_active">نشط (يمكنه تسجيل الدخول)</Label>
                        </div>
                        {!editing && <>
                            <div><Label>البريد الإلكتروني (لتسجيل الدخول) *</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({...f, email: e.target.value}))} data-testid="emp-email" /></div>
                            <div><Label>كلمة المرور *</Label><Input type="password" value={form.password} onChange={(e) => setForm(f => ({...f, password: e.target.value}))} data-testid="emp-password" /></div>
                        </>}
                        {editing && (
                            <div className="col-span-2">
                                <Label>كلمة مرور جديدة (اختياري — اتركه فارغاً للإبقاء على الحالية)</Label>
                                <Input type="password" value={form.password} onChange={(e) => setForm(f => ({...f, password: e.target.value}))} data-testid="emp-password-new" placeholder="•••••••" />
                            </div>
                        )}
                    </div>
                    <DialogFooter><Button onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="save-employee-btn">{editing ? "حفظ التعديلات" : "حفظ الموظف"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Loans Dialog */}
            <Dialog open={!!loanOpenFor} onOpenChange={(v) => !v && setLoanOpenFor(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <HandCoins className="w-5 h-5 text-amber-600" /> سلف الموظف — {loanOpenFor?.name}
                            <Badge className="bg-amber-100 text-amber-800 mr-auto">إجمالي: {fmt(loans.total)}</Badge>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-4 gap-3 bg-amber-50 border border-amber-200 rounded p-3">
                        <div className="col-span-1"><Label>المبلغ</Label><Input type="number" value={loanForm.amount} onChange={(e) => setLoanForm(f => ({...f, amount: e.target.value}))} data-testid="loan-amount" /></div>
                        <div className="col-span-2"><Label>السبب</Label><Input value={loanForm.reason} onChange={(e) => setLoanForm(f => ({...f, reason: e.target.value}))} data-testid="loan-reason" placeholder="مثال: ظروف صحية، إيجار..." /></div>
                        <div className="col-span-1"><Label>التاريخ</Label><Input type="date" value={loanForm.date} onChange={(e) => setLoanForm(f => ({...f, date: e.target.value}))} data-testid="loan-date" /></div>
                        <div className="col-span-4"><Button onClick={saveLoan} className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2" data-testid="save-loan"><Plus className="w-4 h-4" /> إضافة سلفة</Button></div>
                    </div>
                    <div className="max-h-72 overflow-y-auto border border-zinc-200 rounded">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-right text-xs text-slate-600 sticky top-0"><tr><th className="p-2">التاريخ</th><th className="p-2">المبلغ</th><th className="p-2">السبب</th><th className="p-2"></th></tr></thead>
                            <tbody>
                                {loans.rows.map(l => (
                                    <tr key={l.id} className="border-b border-zinc-100">
                                        <td className="p-2 tabular-nums text-slate-600">{l.date}</td>
                                        <td className="p-2 tabular-nums font-semibold text-rose-700">{fmt(l.amount)}</td>
                                        <td className="p-2">{l.reason || "—"}</td>
                                        <td className="p-2"><Button size="sm" variant="outline" onClick={() => delLoan(l.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button></td>
                                    </tr>
                                ))}
                                {loans.rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">لا توجد سلف مسجّلة</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
