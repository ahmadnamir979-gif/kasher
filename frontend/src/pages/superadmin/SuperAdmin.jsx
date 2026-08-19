import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AppShell, { SideLink } from "@/components/layout/AppShell";
import { api, formatApiError, fmt, fmtInt } from "@/lib/api";
import { LayoutDashboard, Store, CreditCard, Users, BarChart3, Plus, Power, CalendarPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function Sidebar() {
    const { pathname } = useLocation();
    const links = [
        { to: "/admin", icon: LayoutDashboard, label: "لوحة التحكم" },
        { to: "/admin/shops", icon: Store, label: "المحلات" },
        { to: "/admin/subscriptions", icon: CreditCard, label: "الاشتراكات" },
    ];
    return links.map(l => <SideLink key={l.to} to={l.to} icon={l.icon} active={pathname === l.to}>{l.label}</SideLink>);
}

function StatCard({ label, value, hint, color = "slate" }) {
    const bg = { slate: "bg-slate-900", blue: "bg-blue-600", emerald: "bg-emerald-600", amber: "bg-amber-500", rose: "bg-rose-600" }[color];
    return (
        <Card className="p-5 border-zinc-200">
            <div className="flex items-start justify-between mb-3">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
                <div className={`w-2 h-2 rounded-full ${bg}`} />
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
            {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        </Card>
    );
}

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [shops, setShops] = useState([]);
    useEffect(() => {
        api.get("/admin/stats").then(r => setStats(r.data));
        api.get("/admin/shops").then(r => setShops(r.data));
    }, []);
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="إجمالي المحلات" value={fmtInt(stats?.total_shops || 0)} hint="محل مسجّل" color="slate" />
                <StatCard label="المحلات النشطة" value={fmtInt(stats?.active_shops || 0)} hint="اشتراك ساري" color="emerald" />
                <StatCard label="اشتراكات منتهية" value={fmtInt(stats?.expired_shops || 0)} hint="تحتاج تجديد" color="amber" />
                <StatCard label="إجمالي المبيعات" value={fmt(stats?.total_sales || 0)} hint={`${fmtInt(stats?.total_invoices || 0)} فاتورة`} color="blue" />
            </div>
            <Card className="border-zinc-200">
                <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-900">أحدث المحلات</h3>
                        <p className="text-xs text-slate-500">آخر 10 محلات مسجّلة</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr className="text-right text-xs font-medium text-slate-600">
                                <th className="p-3">المحل</th><th className="p-3">المالك</th>
                                <th className="p-3">الاشتراك حتى</th><th className="p-3">المبيعات</th><th className="p-3">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shops.slice(0, 10).map(s => (
                                <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                                    <td className="p-3 font-medium text-slate-900">{s.name}</td>
                                    <td className="p-3 text-slate-600">{s.owner?.name} <span className="text-slate-400 text-xs">({s.owner?.email})</span></td>
                                    <td className="p-3 tabular-nums text-slate-700">{s.subscription_expires_at?.substring(0,10)}</td>
                                    <td className="p-3 tabular-nums font-semibold">{fmt(s.sales_total)}</td>
                                    <td className="p-3">{s.is_active ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">نشط</Badge> : <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">موقوف</Badge>}</td>
                                </tr>
                            ))}
                            {shops.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">لا توجد محلات بعد</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function Shops() {
    const [shops, setShops] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", owner_name: "", owner_email: "", owner_password: "", phone: "", address: "", subscription_months: 12 });
    const load = () => api.get("/admin/shops").then(r => setShops(r.data));
    useEffect(() => { load(); }, []);
    const create = async () => {
        try { await api.post("/admin/shops", form); toast.success("تم إنشاء المحل"); setOpen(false); setForm({ name: "", owner_name: "", owner_email: "", owner_password: "", phone: "", address: "", subscription_months: 12 }); load(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const toggle = async (s) => { await api.patch(`/admin/shops/${s.id}`, { is_active: !s.is_active }); toast.success(s.is_active ? "تم إيقاف المحل" : "تم تفعيل المحل"); load(); };
    const extend = async (s, months) => { await api.post(`/admin/shops/${s.id}/extend`, { months }); toast.success(`تمّ تمديد ${months} شهر`); load(); };
    const remove = async (s) => { if (!window.confirm(`حذف المحل ${s.name}؟`)) return; await api.delete(`/admin/shops/${s.id}`); toast.success("تم الحذف"); load(); };

    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
                <div><h3 className="font-semibold text-slate-900">جميع المحلات</h3><p className="text-xs text-slate-500">{shops.length} محل</p></div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button data-testid="add-shop-btn" className="bg-slate-900 hover:bg-slate-800 text-white gap-2"><Plus className="w-4 h-4" /> إضافة محل</Button></DialogTrigger>
                    <DialogContent dir="rtl" className="bg-white">
                        <DialogHeader><DialogTitle>إضافة محل جديد</DialogTitle></DialogHeader>
                        <div className="grid grid-cols-2 gap-3">
                            {[["اسم المحل","name"],["اسم المالك","owner_name"],["بريد المالك","owner_email"],["كلمة المرور","owner_password"],["الهاتف","phone"],["العنوان","address"]].map(([l,k]) => (
                                <div key={k} className={k==="address"?"col-span-2":""}><Label>{l}</Label>
                                    <Input data-testid={`shop-${k}-input`} type={k==="owner_password"?"password":"text"} value={form[k]} onChange={(e) => setForm(f => ({...f, [k]: e.target.value}))} className="mt-1" /></div>
                            ))}
                            <div><Label>مدة الاشتراك (شهر)</Label><Input type="number" value={form.subscription_months} onChange={(e) => setForm(f => ({...f, subscription_months: +e.target.value}))} className="mt-1" /></div>
                        </div>
                        <DialogFooter><Button onClick={create} data-testid="save-shop-btn" className="bg-slate-900 hover:bg-slate-800 text-white">حفظ</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs font-medium text-slate-600">
                        <tr><th className="p-3">المحل</th><th className="p-3">المالك / الدخول</th><th className="p-3">الاشتراك</th><th className="p-3">المبيعات</th><th className="p-3">الحالة</th><th className="p-3">إجراءات</th></tr>
                    </thead>
                    <tbody>
                        {shops.map(s => (
                            <tr key={s.id} className="border-b border-zinc-100" data-testid={`shop-row-${s.id}`}>
                                <td className="p-3"><div className="font-medium text-slate-900">{s.name}</div><div className="text-xs text-slate-500">{s.phone}</div></td>
                                <td className="p-3"><div className="text-slate-800">{s.owner?.name}</div><div className="text-xs text-slate-500 tabular-nums">{s.owner?.email}</div></td>
                                <td className="p-3 tabular-nums">{s.subscription_expires_at?.substring(0,10)}</td>
                                <td className="p-3 tabular-nums font-semibold">{fmt(s.sales_total)} <span className="text-xs text-slate-400">({fmtInt(s.invoices_count)} فاتورة)</span></td>
                                <td className="p-3">{s.is_active ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">نشط</Badge> : <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">موقوف</Badge>}</td>
                                <td className="p-3">
                                    <div className="flex items-center gap-1.5">
                                        <Button size="sm" variant="outline" onClick={() => extend(s, 12)} data-testid={`extend-${s.id}`}><CalendarPlus className="w-3.5 h-3.5 ml-1" /> +١٢ش</Button>
                                        <Button size="sm" variant="outline" onClick={() => toggle(s)} data-testid={`toggle-${s.id}`}><Power className="w-3.5 h-3.5" /></Button>
                                        <Button size="sm" variant="outline" onClick={() => remove(s)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {shops.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">اضغط "إضافة محل" للبدء</td></tr>}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function Subscriptions() {
    const [shops, setShops] = useState([]);
    useEffect(() => { api.get("/admin/shops").then(r => setShops(r.data)); }, []);
    const today = new Date();
    const rows = shops.map(s => {
        const exp = new Date(s.subscription_expires_at);
        const days = Math.ceil((exp - today) / 86400000);
        return { ...s, days };
    }).sort((a,b) => a.days - b.days);
    return (
        <Card className="border-zinc-200">
            <div className="p-5 border-b border-zinc-200"><h3 className="font-semibold">حالة الاشتراكات</h3><p className="text-xs text-slate-500">تتبع اشتراكات جميع المحلات ومواعيد التجديد</p></div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-right text-xs text-slate-600"><tr><th className="p-3">المحل</th><th className="p-3">تاريخ الانتهاء</th><th className="p-3">الأيام المتبقية</th><th className="p-3">الحالة</th></tr></thead>
                <tbody>
                    {rows.map(s => (
                        <tr key={s.id} className="border-b border-zinc-100">
                            <td className="p-3 font-medium">{s.name}</td>
                            <td className="p-3 tabular-nums">{s.subscription_expires_at?.substring(0,10)}</td>
                            <td className="p-3 tabular-nums">{s.days} يوم</td>
                            <td className="p-3">{s.days < 0 ? <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">منتهي</Badge> : s.days < 30 ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">قارب الانتهاء</Badge> : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">ساري</Badge>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
}

export default function SuperAdmin() {
    const { pathname } = useLocation();
    const titles = { "/admin": ["لوحة التحكم", "نظرة عامة على جميع المحلات"], "/admin/shops": ["المحلات", "إدارة المحلات المشتركة"], "/admin/subscriptions": ["الاشتراكات", "متابعة تجديدات الاشتراك"] };
    const [t, sub] = titles[pathname] || ["", ""];
    return (
        <AppShell title={t} subtitle={sub} sidebar={<Sidebar />}>
            <Routes>
                <Route index element={<Dashboard />} />
                <Route path="shops" element={<Shops />} />
                <Route path="subscriptions" element={<Subscriptions />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
        </AppShell>
    );
}
