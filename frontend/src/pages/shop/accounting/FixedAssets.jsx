import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Building2, RefreshCw, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const CAT_META = {
    equipment: { label: "معدات", color: "bg-blue-100 text-blue-800" },
    vehicle: { label: "مركبات", color: "bg-purple-100 text-purple-800" },
    building: { label: "مبانٍ", color: "bg-emerald-100 text-emerald-800" },
    furniture: { label: "أثاث", color: "bg-amber-100 text-amber-800" },
    other: { label: "أخرى", color: "bg-slate-100 text-slate-800" },
};

export default function FixedAssets() {
    const today = new Date().toISOString().slice(0, 10);
    const [assets, setAssets] = useState([]);
    const [summary, setSummary] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [open, setOpen] = useState(false);
    const [asOf, setAsOf] = useState(today);
    const [form, setForm] = useState({
        name: "", category: "equipment", purchase_date: today,
        purchase_cost: 0, useful_life_years: 5, salvage_value: 0,
        payment_account_id: "", notes: "",
    });

    const load = async () => {
        try {
            const [a, s, ac] = await Promise.all([
                api.get("/fixed-assets", { params: { as_of: asOf } }),
                api.get("/fixed-assets/summary", { params: { as_of: asOf } }),
                api.get("/accounting/accounts"),
            ]);
            setAssets(a.data); setSummary(s.data);
            setAccounts(ac.data.filter(x => !x.is_group && (x.is_cash || x.is_bank || x.type === "asset")));
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [asOf]);

    const submit = async () => {
        try {
            await api.post("/fixed-assets", {
                ...form,
                purchase_cost: Number(form.purchase_cost),
                useful_life_years: Number(form.useful_life_years),
                salvage_value: Number(form.salvage_value),
                payment_account_id: form.payment_account_id || null,
            });
            toast.success("تم إضافة الأصل الثابت"); setOpen(false);
            setForm({ name: "", category: "equipment", purchase_date: today, purchase_cost: 0, useful_life_years: 5, salvage_value: 0, payment_account_id: "", notes: "" });
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const depreciateAll = async () => {
        if (!window.confirm(`ترحيل قيود الإهلاك حتى ${asOf}؟\nسيتم إنشاء قيد يومية لكل أصل بمصروف الإهلاك المتراكم.`)) return;
        try {
            const r = await api.post("/fixed-assets/depreciate-all", { as_of: asOf });
            toast.success(`تم ترحيل إهلاك ${r.data.assets_updated} أصل بقيمة ${fmt(r.data.posted_total)}`);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const depreciateOne = async (aid) => {
        try {
            const r = await api.post(`/fixed-assets/${aid}/depreciate`, { as_of: asOf });
            if (r.data.already_up_to_date) toast.info("محدث سابقاً");
            else toast.success(`تم ترحيل ${fmt(r.data.posted)}`);
            load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const dispose = async (aid) => {
        if (!window.confirm("إخراج الأصل من الخدمة؟ لن يتم حساب إهلاك بعد الآن.")) return;
        try { await api.delete(`/fixed-assets/${aid}`); toast.success("تم"); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">الأصول الثابتة والإهلاك</h2>
                    <p className="text-sm text-slate-500">{assets.length} أصل ثابت — قسط ثابت شهرياً بطريقة الخط المستقيم</p>
                </div>
                <Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="max-w-xs" data-testid="fa-asof" />
                <Button onClick={depreciateAll} className="gap-1 bg-purple-600 hover:bg-purple-700" data-testid="fa-depreciate-all"><RefreshCw className="w-4 h-4" />ترحيل الإهلاك</Button>
                <Button onClick={() => setOpen(true)} className="gap-1 bg-emerald-600 hover:bg-emerald-700" data-testid="fa-add-btn"><Plus className="w-4 h-4" />أصل جديد</Button>
            </div>

            {summary && (
                <div className="grid grid-cols-4 gap-3">
                    <Card className="p-4 border-zinc-200">
                        <div className="text-xs text-slate-500">عدد الأصول النشطة</div>
                        <div className="text-2xl font-bold tabular-nums mt-1">{summary.count}</div>
                    </Card>
                    <Card className="p-4 border-zinc-200 bg-blue-50/40">
                        <div className="text-xs text-blue-700">التكلفة الإجمالية</div>
                        <div className="text-2xl font-bold tabular-nums mt-1 text-blue-800">{fmt(summary.gross_cost)}</div>
                    </Card>
                    <Card className="p-4 border-zinc-200 bg-rose-50/40">
                        <div className="text-xs text-rose-700">مجمع الإهلاك</div>
                        <div className="text-2xl font-bold tabular-nums mt-1 text-rose-800">-{fmt(summary.accumulated_depreciation)}</div>
                    </Card>
                    <Card className="p-4 border-zinc-200 bg-emerald-50/40">
                        <div className="text-xs text-emerald-700">القيمة الدفترية الصافية</div>
                        <div className="text-2xl font-bold tabular-nums mt-1 text-emerald-800" data-testid="fa-nbv">{fmt(summary.net_book_value)}</div>
                    </Card>
                </div>
            )}

            <Card className="overflow-x-auto border-zinc-200">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs text-slate-600">
                        <tr>
                            <th className="p-3">الاسم</th>
                            <th className="p-3">النوع</th>
                            <th className="p-3">تاريخ الشراء</th>
                            <th className="p-3">التكلفة</th>
                            <th className="p-3">العمر (سنة)</th>
                            <th className="p-3">إهلاك شهري</th>
                            <th className="p-3">مجمع الإهلاك</th>
                            <th className="p-3">القيمة الدفترية</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map(a => {
                            const d = a.depreciation || {};
                            return (
                                <tr key={a.id} className={`border-b border-zinc-100 ${a.disposed_at ? "opacity-50 line-through" : ""}`} data-testid={`fa-row-${a.id}`}>
                                    <td className="p-3 font-semibold">{a.name}</td>
                                    <td className="p-3"><Badge className={CAT_META[a.category]?.color}>{CAT_META[a.category]?.label}</Badge></td>
                                    <td className="p-3 tabular-nums">{a.purchase_date}</td>
                                    <td className="p-3 tabular-nums">{fmt(a.purchase_cost)}</td>
                                    <td className="p-3 tabular-nums">{a.useful_life_years}</td>
                                    <td className="p-3 tabular-nums text-rose-600">{fmt(d.monthly)}</td>
                                    <td className="p-3 tabular-nums text-rose-600">-{fmt(d.accumulated)}</td>
                                    <td className="p-3 tabular-nums font-semibold text-emerald-700">{fmt(d.net_book_value)}</td>
                                    <td className="p-3">
                                        <div className="flex gap-1">
                                            {!a.disposed_at && <Button size="sm" variant="outline" onClick={() => depreciateOne(a.id)} className="gap-1 text-purple-600" data-testid={`fa-dep-${a.id}`}><TrendingDown className="w-3 h-3" />إهلاك</Button>}
                                            {!a.disposed_at && <Button size="sm" variant="ghost" onClick={() => dispose(a.id)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {assets.length === 0 && <tr><td colSpan="9" className="p-8 text-center text-slate-400">لا توجد أصول ثابتة</td></tr>}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>أصل ثابت جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="اسم الأصل (مثلاً: سيارة نقل)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="fa-name" />
                        <div className="grid grid-cols-2 gap-2">
                            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                                <SelectTrigger data-testid="fa-category"><SelectValue /></SelectTrigger>
                                <SelectContent>{Object.entries(CAT_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <Input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} data-testid="fa-date" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-xs">التكلفة</label><Input type="number" step="0.01" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} data-testid="fa-cost" /></div>
                            <div><label className="text-xs">العمر بالسنوات</label><Input type="number" step="0.5" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))} data-testid="fa-life" /></div>
                            <div><label className="text-xs">قيمة الخردة</label><Input type="number" step="0.01" value={form.salvage_value} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))} data-testid="fa-salvage" /></div>
                        </div>
                        <div>
                            <label className="text-xs">حساب الدفع (صندوق/بنك) — اختياري</label>
                            <Select value={form.payment_account_id} onValueChange={v => setForm(f => ({ ...f, payment_account_id: v }))}>
                                <SelectTrigger data-testid="fa-pay-acc"><SelectValue placeholder="افتراضي: الصندوق" /></SelectTrigger>
                                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <Input placeholder="ملاحظات" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-3 text-blue-800">
                            سيتم قيد شراء الأصل تلقائياً في اليومية (مدين: الأصل الثابت / دائن: الصندوق أو البنك)
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={submit} disabled={!form.name || !form.purchase_cost} data-testid="fa-save">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
