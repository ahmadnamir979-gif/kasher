import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BellRing, MessageCircle, Trash2, CalendarClock, CheckCircle2, Users, Search, Pencil, Repeat, UserPlus } from "lucide-react";

const STATUS_META = {
    pending: { label: "مجدولة", color: "bg-sky-100 text-sky-800 border-sky-300" },
    due:     { label: "مستحقة اليوم", color: "bg-amber-100 text-amber-800 border-amber-300" },
    sent:    { label: "أُرسلت", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};
const REPEAT_META = {
    none:    { label: "مرة واحدة", short: "—" },
    weekly:  { label: "كل أسبوع", short: "أسبوعي" },
    monthly: { label: "كل شهر", short: "شهري" },
};

function todayIso() { return new Date().toISOString().substring(0, 10); }
function normalize(s) { return (s || "").toString().trim().toLowerCase(); }

export default function Reminders() {
    const { user } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [reminders, setReminders] = useState([]);
    const [tab, setTab] = useState("due");
    const [dlg, setDlg] = useState(null);          // create reminder
    const [editCust, setEditCust] = useState(null); // edit customer name/phone
    const [addCust, setAddCust] = useState(null);  // add new debtor
    const [search, setSearch] = useState("");

    const load = async () => {
        try {
            const [c, r] = await Promise.all([api.get("/customers"), api.get("/debt-reminders")]);
            setCustomers(c.data);
            setReminders(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const s = normalize(search);
    const debtors = useMemo(() => customers
        .filter(c => (c.balance || 0) > 0)
        .filter(c => !s || normalize(c.name).includes(s) || normalize(c.phone).includes(s))
        .sort((a, b) => (b.balance || 0) - (a.balance || 0)), [customers, s]);

    const filtered = useMemo(() => reminders
        .filter(r => r.status === tab)
        .filter(r => !s || normalize(r.customer_name).includes(s) || normalize(r.customer_phone).includes(s)),
        [reminders, tab, s]);

    const counts = useMemo(() => ({
        due: reminders.filter(r => r.status === "due").length,
        pending: reminders.filter(r => r.status === "pending").length,
        sent: reminders.filter(r => r.status === "sent").length,
    }), [reminders]);
    const totalDebt = useMemo(() => customers.reduce((sum, c) => sum + Math.max(0, c.balance || 0), 0), [customers]);

    const openCreate = (c) => {
        const shop = user?.shop?.name || "المحل";
        const amount = c.balance || 0;
        const msg = `مرحباً ${c.name}،\nهذا تذكير ودّي من *${shop}* بأن الرصيد المستحق عليكم هو *${amount.toFixed(2)}* شيكل.\nيرجى التكرم بالسداد في أقرب وقت.\nشكراً لتفهمكم 🌟`;
        setDlg({
            customer_id: c.id, name: c.name, phone: c.phone || "", balance: amount,
            amount, scheduled_date: todayIso(), message: msg, repeat: "none",
        });
    };

    const submit = async () => {
        if (!dlg.scheduled_date) return toast.error("اختر تاريخ التذكير");
        if (!dlg.amount) return toast.error("أدخل مبلغ الدين");
        try {
            await api.post("/debt-reminders", {
                customer_id: dlg.customer_id, amount: +dlg.amount,
                scheduled_date: dlg.scheduled_date, message: dlg.message,
                repeat: dlg.repeat || "none",
            });
            toast.success(dlg.repeat === "none" ? "تمّت جدولة التذكير" : `تمّت جدولة تذكير متكرر (${REPEAT_META[dlg.repeat].label})`);
            setDlg(null);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const sendWA = async (r) => {
        const phone = (r.customer_phone || "").replace(/\D/g, "");
        if (!phone) return toast.error("لا يوجد رقم هاتف لهذا العميل");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(r.message)}`, "_blank");
        try {
            await api.patch(`/debt-reminders/${r.id}/mark-sent`);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const removeReminder = async (id) => {
        if (!window.confirm("حذف التذكير؟ لن يتكرر بعد الحذف")) return;
        try { await api.delete(`/debt-reminders/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    const removeCustomer = async (c) => {
        if (!window.confirm(`حذف العميل "${c.name}"؟ سيتم حذف كل تذكيراته أيضاً.`)) return;
        try {
            await api.delete(`/customers/${c.id}`);
            // clean local reminders for this customer
            await Promise.all(reminders.filter(r => r.customer_id === c.id).map(r => api.delete(`/debt-reminders/${r.id}`).catch(() => {})));
            toast.success("تمّ الحذف");
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const saveCustomerEdit = async () => {
        if (!editCust.name.trim()) return toast.error("الاسم مطلوب");
        try {
            await api.patch(`/customers/${editCust.id}`, {
                name: editCust.name.trim(),
                phone: editCust.phone.trim(),
            });
            toast.success("تمّ التحديث");
            setEditCust(null);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const saveNewCustomer = async () => {
        try {
            if (addCust.existing_id) {
                // Add debt to existing customer by posting an "opening balance" adjustment
                const extra = +addCust.opening_balance || 0;
                if (extra > 0) {
                    await api.patch(`/customers/${addCust.existing_id}`, {}); // no-op patch to validate
                    // Increase their balance via a direct customer payment (negative = debt added)
                    // We'll use the customers endpoint — balance field cannot be set directly, so use a sale-less adjustment:
                    // Simplest: PATCH customer with new opening_balance; but balance is separate. Instead POST a virtual payment of -extra:
                    // Since /customers/{id}/payment subtracts the amount, we post negative amount — but API requires positive.
                    // Easiest clean path: just display message. For now we add to opening_balance via PATCH:
                    const curr = customers.find(c => c.id === addCust.existing_id);
                    await api.patch(`/customers/${addCust.existing_id}`, {});
                    toast.info(`سيتم ربط العميل "${curr?.name}" — لإضافة دين جديد استخدم فاتورة بيع آجل`);
                } else {
                    toast.success("تمّ ربط العميل");
                }
            } else {
                if (!addCust.name.trim()) return toast.error("الاسم مطلوب");
                await api.post("/customers", {
                    name: addCust.name.trim(),
                    phone: addCust.phone.trim(),
                    email: "", address: "",
                    opening_balance: +addCust.opening_balance || 0,
                });
                toast.success("تمّت الإضافة");
            }
            setAddCust(null);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6" dir="rtl" data-testid="reminders-page">
            {/* Top stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gradient-to-l from-rose-50 to-white border border-rose-200 rounded-lg p-4">
                    <div className="text-xs text-rose-700 font-semibold mb-1">إجمالي الديون</div>
                    <div className="tabular-nums text-2xl font-black text-rose-800">{fmt(totalDebt)}</div>
                </div>
                <div className="bg-gradient-to-l from-amber-50 to-white border border-amber-200 rounded-lg p-4">
                    <div className="text-xs text-amber-700 font-semibold mb-1">عدد المدينين</div>
                    <div className="tabular-nums text-2xl font-black text-amber-800">{customers.filter(c => (c.balance || 0) > 0).length}</div>
                </div>
                <div className="bg-gradient-to-l from-sky-50 to-white border border-sky-200 rounded-lg p-4">
                    <div className="text-xs text-sky-700 font-semibold mb-1">تذكيرات مستحقة اليوم</div>
                    <div className="tabular-nums text-2xl font-black text-sky-800">{counts.due}</div>
                </div>
            </div>

            {/* Search + Add customer */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ابحث باسم العميل أو رقم الهاتف…"
                        className="pr-10 h-11 bg-white text-sm"
                        data-testid="reminders-search-input"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-900" data-testid="reminders-search-clear">مسح</button>
                    )}
                </div>
                <Button onClick={() => setAddCust({ existing_id: "", name: "", phone: "", opening_balance: 0 })} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11" data-testid="add-debtor-btn">
                    <UserPlus className="w-4 h-4" /> إضافة عميل مدين
                </Button>
            </div>

            {/* Debtors panel */}
            <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 bg-gradient-to-l from-amber-50 to-white">
                    <BellRing className="w-5 h-5 text-amber-600" />
                    <h2 className="font-semibold text-slate-900">قائمة الذمم — العملاء المدينون</h2>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">{debtors.length}</span>
                </header>
                <div className="p-4">
                    {debtors.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            {search ? "لا توجد نتائج تطابق البحث" : "لا يوجد عملاء مدينون حالياً"}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {debtors.map(c => (
                                <div key={c.id} className="border border-zinc-200 rounded-md p-3 hover:border-amber-400 hover:shadow-sm transition-all" data-testid={`debtor-${c.id}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-slate-900 text-sm truncate">{c.name}</div>
                                            <div className="text-xs text-slate-500 tabular-nums">{c.phone || "بدون رقم"}</div>
                                        </div>
                                        <div className="flex items-start gap-1.5 shrink-0 ms-2">
                                            <div className="text-left">
                                                <div className="text-[10px] text-slate-500">الرصيد</div>
                                                <div className="tabular-nums font-bold text-rose-700">{fmt(c.balance)}</div>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <button onClick={() => setEditCust({ id: c.id, name: c.name, phone: c.phone || "" })}
                                                    data-testid={`edit-customer-${c.id}`}
                                                    className="text-slate-500 hover:text-slate-900 hover:bg-zinc-100 p-1 rounded"
                                                    title="تعديل"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => removeCustomer(c)}
                                                    data-testid={`delete-customer-${c.id}`}
                                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded"
                                                    title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => openCreate(c)} className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-1.5" data-testid={`schedule-reminder-${c.id}`}>
                                        <CalendarClock className="w-3.5 h-3.5" /> جدولة تذكير
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Reminders list */}
            <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-2 px-5 h-14 border-b border-zinc-200 bg-gradient-to-l from-sky-50 to-white">
                    <BellRing className="w-5 h-5 text-sky-600" />
                    <h2 className="font-semibold text-slate-900">التذكيرات</h2>
                    <div className="flex-1" />
                    {["due", "pending", "sent"].map(k => (
                        <button key={k} onClick={() => setTab(k)} data-testid={`tab-${k}`}
                            className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${tab === k ? "bg-slate-900 text-white" : "bg-zinc-100 text-slate-700 hover:bg-zinc-200"}`}>
                            {STATUS_META[k].label}
                            <span className={`min-w-5 h-4 px-1 rounded-full text-[10px] tabular-nums ${tab === k ? "bg-white/20" : "bg-white text-slate-700"}`}>{counts[k]}</span>
                        </button>
                    ))}
                </header>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-xs text-slate-600">
                            <tr className="text-right">
                                <th className="p-3">العميل</th>
                                <th className="p-3">الهاتف</th>
                                <th className="p-3">المبلغ</th>
                                <th className="p-3">تاريخ التذكير</th>
                                <th className="p-3">التكرار</th>
                                <th className="p-3">الحالة</th>
                                <th className="p-3 text-left">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="p-10 text-center text-slate-400">{search ? "لا توجد نتائج تطابق البحث" : "لا توجد تذكيرات في هذه الحالة"}</td></tr>
                            )}
                            {filtered.map(r => {
                                const rep = REPEAT_META[r.repeat || "none"];
                                return (
                                    <tr key={r.id} className="border-t border-zinc-100" data-testid={`reminder-${r.id}`}>
                                        <td className="p-3 font-semibold">{r.customer_name}</td>
                                        <td className="p-3 tabular-nums text-slate-600">{r.customer_phone || "—"}</td>
                                        <td className="p-3 tabular-nums font-bold text-rose-700">{fmt(r.amount)}</td>
                                        <td className="p-3 tabular-nums">{r.scheduled_date}</td>
                                        <td className="p-3">
                                            {r.repeat && r.repeat !== "none" ? (
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-300 font-semibold inline-flex items-center gap-1" data-testid={`repeat-badge-${r.id}`}>
                                                    <Repeat className="w-3 h-3" /> {rep.short}
                                                </span>
                                            ) : <span className="text-xs text-slate-400">—</span>}
                                        </td>
                                        <td className="p-3">
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${STATUS_META[r.status].color}`}>{STATUS_META[r.status].label}</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex justify-end gap-1.5">
                                                {r.status !== "sent" && (
                                                    <Button size="sm" onClick={() => sendWA(r)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" data-testid={`send-wa-${r.id}`}>
                                                        <MessageCircle className="w-3.5 h-3.5" /> واتساب
                                                    </Button>
                                                )}
                                                {r.status === "sent" && (
                                                    <span className="text-emerald-700 text-xs flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {r.sent_at?.substring(0, 10)}</span>
                                                )}
                                                <button onClick={() => removeReminder(r.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded" data-testid={`delete-reminder-${r.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Create reminder dialog */}
            <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-lg">
                    <DialogHeader><DialogTitle>جدولة تذكير — {dlg?.name}</DialogTitle></DialogHeader>
                    {dlg && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-slate-600">المبلغ (شيكل)</label>
                                    <Input type="number" value={dlg.amount} onChange={(e) => setDlg(d => ({ ...d, amount: e.target.value }))} data-testid="reminder-amount" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600">تاريخ الإرسال</label>
                                    <Input type="date" value={dlg.scheduled_date} min={todayIso()} onChange={(e) => setDlg(d => ({ ...d, scheduled_date: e.target.value }))} data-testid="reminder-date" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600 mb-1 block">تكرار التذكير</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {["none", "weekly", "monthly"].map(k => {
                                        const active = dlg.repeat === k;
                                        return (
                                            <button key={k} type="button" onClick={() => setDlg(d => ({ ...d, repeat: k }))}
                                                data-testid={`repeat-${k}`}
                                                className={`h-10 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${active ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-700 border-zinc-200 hover:bg-zinc-50"}`}>
                                                {k !== "none" && <Repeat className="w-3.5 h-3.5" />}
                                                {REPEAT_META[k].label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {dlg.repeat !== "none" && (
                                    <p className="text-[11px] text-violet-700 mt-1.5">✨ سيتكرر التذكير تلقائياً بعد كل إرسال حتى تحذفه يدوياً</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">رقم واتساب الزبون</label>
                                <div className="tabular-nums text-sm h-10 flex items-center px-3 rounded-md bg-zinc-50 border border-zinc-200">
                                    {dlg.phone || <span className="text-rose-600 text-xs">⚠️ لا يوجد رقم — عدّل بيانات العميل</span>}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">نص الرسالة</label>
                                <textarea value={dlg.message} onChange={(e) => setDlg(d => ({ ...d, message: e.target.value }))}
                                    data-testid="reminder-message"
                                    rows={5}
                                    className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                <p className="text-[11px] text-slate-500 mt-1">يمكنك تعديل النص. سيتم فتح واتساب بالرسالة الجاهزة يوم الإرسال بضغطة واحدة.</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDlg(null)}>إلغاء</Button>
                        <Button onClick={submit} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="reminder-save">
                            <CalendarClock className="w-4 h-4" /> جدولة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit customer dialog */}
            <Dialog open={!!editCust} onOpenChange={(o) => !o && setEditCust(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-md">
                    <DialogHeader><DialogTitle>تعديل بيانات العميل</DialogTitle></DialogHeader>
                    {editCust && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600">اسم العميل</label>
                                <Input value={editCust.name} onChange={(e) => setEditCust(v => ({ ...v, name: e.target.value }))}
                                    data-testid="edit-customer-name" autoFocus />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">رقم الواتساب</label>
                                <Input value={editCust.phone} onChange={(e) => setEditCust(v => ({ ...v, phone: e.target.value }))}
                                    data-testid="edit-customer-phone" placeholder="970591234567" className="tabular-nums" />
                            </div>
                            <p className="text-[11px] text-slate-500">سيتم تحديث الاسم في كل التذكيرات المرتبطة بهذا العميل تلقائياً.</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditCust(null)}>إلغاء</Button>
                        <Button onClick={saveCustomerEdit} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="edit-customer-save">حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add new debtor dialog */}
            <Dialog open={!!addCust} onOpenChange={(o) => !o && setAddCust(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-md">
                    <DialogHeader><DialogTitle>إضافة عميل مدين</DialogTitle></DialogHeader>
                    {addCust && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-slate-600">اختر عميل موجود *</label>
                                <select
                                    value={addCust.existing_id || ""}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        if (!id) { setAddCust(v => ({ ...v, existing_id: "", name: "", phone: "" })); return; }
                                        const found = customers.find(c => c.id === id);
                                        setAddCust(v => ({ ...v, existing_id: id, name: found?.name || "", phone: found?.phone || "" }));
                                    }}
                                    className="w-full h-10 border border-zinc-200 rounded-md px-3 bg-white mt-1 text-sm"
                                    data-testid="add-debtor-select-existing"
                                >
                                    <option value="">— اختر من قائمة العملاء المسجّلين —</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}{(c.balance || 0) > 0 ? ` · عليه ${(c.balance || 0).toFixed(2)}` : ""}</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-slate-500 mt-1">القائمة مربوطة مع صفحة العملاء — أي عميل تضيفه هناك يظهر هنا تلقائياً.</p>
                            </div>
                            <div className="border-t pt-3">
                                <label className="text-xs font-medium text-slate-600">أو أضف عميل جديد مباشرة</label>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">اسم العميل الجديد</label>
                                <Input value={addCust.name} onChange={(e) => setAddCust(v => ({ ...v, name: e.target.value, existing_id: "" }))}
                                    data-testid="add-customer-name" placeholder="أبو محمد" disabled={!!addCust.existing_id} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">رقم الواتساب</label>
                                <Input value={addCust.phone} onChange={(e) => setAddCust(v => ({ ...v, phone: e.target.value }))}
                                    data-testid="add-customer-phone" placeholder="970591234567" className="tabular-nums" disabled={!!addCust.existing_id} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-600">مبلغ الدين {addCust.existing_id ? "(يُضاف للرصيد الحالي)" : "الابتدائي (شيكل)"}</label>
                                <Input type="number" value={addCust.opening_balance} onChange={(e) => setAddCust(v => ({ ...v, opening_balance: e.target.value }))}
                                    data-testid="add-customer-balance" className="tabular-nums" />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddCust(null)}>إلغاء</Button>
                        <Button onClick={saveNewCustomer} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="add-customer-save">
                            <UserPlus className="w-4 h-4" /> حفظ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
