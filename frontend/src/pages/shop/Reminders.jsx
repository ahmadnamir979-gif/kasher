import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BellRing, MessageCircle, Trash2, CalendarClock, CheckCircle2, Users } from "lucide-react";

const STATUS_META = {
    pending: { label: "مجدولة", color: "bg-sky-100 text-sky-800 border-sky-300" },
    due:     { label: "مستحقة اليوم", color: "bg-amber-100 text-amber-800 border-amber-300" },
    sent:    { label: "أُرسلت", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

function todayIso() { return new Date().toISOString().substring(0, 10); }

export default function Reminders() {
    const { user } = useAuth();
    const [customers, setCustomers] = useState([]);
    const [reminders, setReminders] = useState([]);
    const [tab, setTab] = useState("due");
    const [dlg, setDlg] = useState(null); // {customer_id, name, balance, amount, scheduled_date, message}

    const load = async () => {
        try {
            const [c, r] = await Promise.all([api.get("/customers"), api.get("/debt-reminders")]);
            setCustomers(c.data);
            setReminders(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const debtors = useMemo(() => customers.filter(c => (c.balance || 0) > 0).sort((a, b) => (b.balance || 0) - (a.balance || 0)), [customers]);

    const filtered = useMemo(() => reminders.filter(r => r.status === tab), [reminders, tab]);
    const counts = useMemo(() => ({
        due: reminders.filter(r => r.status === "due").length,
        pending: reminders.filter(r => r.status === "pending").length,
        sent: reminders.filter(r => r.status === "sent").length,
    }), [reminders]);

    const openCreate = (c) => {
        const shop = user?.shop?.name || "المحل";
        const amount = c.balance || 0;
        const msg = `مرحباً ${c.name}،\nهذا تذكير ودّي من *${shop}* بأن الرصيد المستحق عليكم هو *${amount.toFixed(2)}* شيكل.\nيرجى التكرم بالسداد في أقرب وقت.\nشكراً لتفهمكم 🌟`;
        setDlg({
            customer_id: c.id, name: c.name, phone: c.phone || "", balance: amount,
            amount, scheduled_date: todayIso(), message: msg,
        });
    };

    const submit = async () => {
        if (!dlg.scheduled_date) return toast.error("اختر تاريخ التذكير");
        if (!dlg.amount) return toast.error("أدخل مبلغ الدين");
        try {
            await api.post("/debt-reminders", {
                customer_id: dlg.customer_id, amount: +dlg.amount,
                scheduled_date: dlg.scheduled_date, message: dlg.message,
            });
            toast.success("تمّت جدولة التذكير");
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

    const remove = async (id) => {
        if (!window.confirm("حذف التذكير؟")) return;
        try { await api.delete(`/debt-reminders/${id}`); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-6" dir="rtl" data-testid="reminders-page">
            {/* Debtors panel */}
            <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 bg-gradient-to-l from-amber-50 to-white">
                    <BellRing className="w-5 h-5 text-amber-600" />
                    <h2 className="font-semibold text-slate-900">العملاء المدينون</h2>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">{debtors.length}</span>
                </header>
                <div className="p-4">
                    {debtors.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            لا يوجد عملاء مدينون حالياً
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {debtors.map(c => (
                                <div key={c.id} className="border border-zinc-200 rounded-md p-3 hover:border-amber-400 hover:shadow-sm transition-all" data-testid={`debtor-${c.id}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-semibold text-slate-900 text-sm">{c.name}</div>
                                            <div className="text-xs text-slate-500 tabular-nums">{c.phone || "بدون رقم"}</div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[10px] text-slate-500">الرصيد</div>
                                            <div className="tabular-nums font-bold text-rose-700">{fmt(c.balance)}</div>
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
                                <th className="p-3">الحالة</th>
                                <th className="p-3 text-left">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} className="p-10 text-center text-slate-400">لا توجد تذكيرات في هذه الحالة</td></tr>
                            )}
                            {filtered.map(r => (
                                <tr key={r.id} className="border-t border-zinc-100" data-testid={`reminder-${r.id}`}>
                                    <td className="p-3 font-semibold">{r.customer_name}</td>
                                    <td className="p-3 tabular-nums text-slate-600">{r.customer_phone || "—"}</td>
                                    <td className="p-3 tabular-nums font-bold text-rose-700">{fmt(r.amount)}</td>
                                    <td className="p-3 tabular-nums">{r.scheduled_date}</td>
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
                                            <button onClick={() => remove(r.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded" data-testid={`delete-reminder-${r.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Create dialog */}
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
                                <label className="text-xs font-medium text-slate-600">رقم واتساب الزبون</label>
                                <div className="tabular-nums text-sm h-10 flex items-center px-3 rounded-md bg-zinc-50 border border-zinc-200">
                                    {dlg.phone || <span className="text-rose-600 text-xs">⚠️ لا يوجد رقم — أضف رقماً في بيانات العميل</span>}
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
        </div>
    );
}
