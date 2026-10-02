import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
    ShoppingCart, Truck, Package, Receipt, BarChart3, UserCog, Settings as SettingsIcon,
    ChevronDown, Store, ClipboardList, Printer, FileSpreadsheet, ArrowLeftRight, Tag,
    AlertTriangle, Factory, Hash, Calculator, ClipboardCheck, Repeat, Warehouse,
    Book, FileText, Landmark, Building2, Target, DollarSign, Lock, Percent, BookOpen,
    Users, Wallet, Clock, BellRing, Calendar, Wand2, Sparkles, LayoutDashboard, ScanBarcode
} from "lucide-react";

const MENUS = [
    {
        title: "رئيسية", icon: LayoutDashboard, color: "from-blue-500 to-blue-700",
        items: [
            { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
            { to: "/assistant", icon: Sparkles, label: "المساعد الذكي" },
            { to: "/pos", icon: ScanBarcode, label: "نقطة البيع" },
        ],
    },
    {
        title: "المبيعات", icon: ShoppingCart, color: "from-emerald-500 to-emerald-700",
        items: [
            { to: "/pos", icon: ScanBarcode, label: "فاتورة بيع (POS)" },
            { to: "/sales", icon: ShoppingCart, label: "فواتير المبيعات" },
            { to: "/orders", icon: ClipboardList, label: "طلبيات مبيعات" },
            { to: "/customers", icon: Users, label: "العملاء" },
            { to: "/reminders", icon: BellRing, label: "ديون وتذكيرات" },
            { to: "/installments", icon: Calendar, label: "خطط التقسيط" },
            { to: "/pricing-tiers", icon: Tag, label: "فئات الأسعار" },
        ],
    },
    {
        title: "المشتريات", icon: Truck, color: "from-indigo-500 to-indigo-700",
        items: [
            { to: "/orders", icon: ClipboardList, label: "طلبية مشتريات" },
            { to: "/purchases", icon: Truck, label: "فاتورة مشتريات" },
            { to: "/purchases", icon: Truck, label: "فاتورة مرتجع مشتريات" },
            { to: "/migration", icon: Wand2, label: "إنشاء فواتير من Excel" },
            { to: "/suppliers", icon: Truck, label: "الموردين" },
            { to: "/inventory-adjustments", icon: ClipboardCheck, label: "ضبط المخازن" },
            { to: "/warehouses", icon: Warehouse, label: "مراكز التوزيع" },
            { to: "/barcodes", icon: Printer, label: "طباعة باركود" },
        ],
    },
    {
        title: "المخازن", icon: Warehouse, color: "from-amber-500 to-amber-700",
        items: [
            { to: "/products", icon: Package, label: "الأصناف والمخزون" },
            { to: "/product-numbering", icon: Hash, label: "ترقيم الأصناف" },
            { to: "/bulk-price", icon: Calculator, label: "معالجة الأسعار" },
            { to: "/alternatives", icon: Repeat, label: "بدائل الأصناف" },
            { to: "/inventory-adjustments", icon: ClipboardCheck, label: "مستندات ضبط" },
            { to: "/warehouses", icon: Warehouse, label: "المخازن" },
            { to: "/transfers", icon: ArrowLeftRight, label: "تحويلات المخزون" },
            { to: "/barcodes", icon: Tag, label: "ملصقات الباركود" },
            { to: "/expiry", icon: AlertTriangle, label: "تواريخ الصلاحية" },
            { to: "/manufacturing", icon: Factory, label: "التصنيع" },
        ],
    },
    {
        title: "المحاسبة", icon: Book, color: "from-purple-500 to-purple-700",
        items: [
            { to: "/accounts", icon: Book, label: "فهرس الحسابات" },
            { to: "/journal", icon: FileText, label: "اليومية العامة" },
            { to: "/ledger", icon: BookOpen, label: "دفتر الأستاذ" },
            { to: "/vouchers", icon: Receipt, label: "السندات (قبض/صرف)" },
            { to: "/banks", icon: Landmark, label: "البنوك والشيكات" },
            { to: "/fixed-assets", icon: Building2, label: "الأصول الثابتة" },
            { to: "/cost-centers", icon: Target, label: "مراكز التكلفة" },
            { to: "/currencies", icon: DollarSign, label: "العملات" },
            { to: "/closed-periods", icon: Lock, label: "الفترات المغلقة" },
        ],
    },
    {
        title: "التقارير", icon: BarChart3, color: "from-rose-500 to-rose-700",
        items: [
            { to: "/financial-reports", icon: BarChart3, label: "تقارير مالية" },
            { to: "/vat", icon: Percent, label: "كشف ضريبة" },
            { to: "/reports", icon: BarChart3, label: "تقارير عامة" },
            { to: "/excel-live", icon: FileSpreadsheet, label: "ربط Excel مباشر" },
        ],
    },
    {
        title: "الموظفين", icon: UserCog, color: "from-cyan-500 to-cyan-700",
        items: [
            { to: "/employees", icon: UserCog, label: "إدارة الموظفين" },
            { to: "/expenses", icon: Wallet, label: "المصاريف" },
            { to: "/shifts", icon: Clock, label: "الورديات" },
        ],
    },
    {
        title: "النظام", icon: SettingsIcon, color: "from-slate-500 to-slate-700",
        items: [
            { to: "/settings", icon: SettingsIcon, label: "الإعدادات" },
            { to: "/migration", icon: Wand2, label: "نقل من نظام قديم" },
        ],
    },
];

export default function MenuBar() {
    const { pathname } = useLocation();
    const [open, setOpen] = useState(null);
    const ref = useRef(null);

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, []);

    return (
        <div ref={ref} className="bg-gradient-to-b from-[#1e3a5f] to-[#243f66] text-white border-b-2 border-amber-500 shadow-md relative z-30">
            <div className="flex items-stretch overflow-x-auto">
                {MENUS.map((m, idx) => {
                    const isOpen = open === idx;
                    const hasActive = m.items.some(it => it.to === pathname);
                    return (
                        <div key={idx} className="relative">
                            <button
                                onClick={() => setOpen(isOpen ? null : idx)}
                                onMouseEnter={() => open !== null && setOpen(idx)}
                                data-testid={`menubar-${m.title}`}
                                className={`h-11 px-4 flex items-center gap-2 text-sm font-bold border-l border-white/10 transition-all whitespace-nowrap ${isOpen ? `bg-gradient-to-b ${m.color} text-white shadow-inner` : hasActive ? "bg-white/10 text-amber-200" : "hover:bg-white/5 text-blue-50"}`}
                            >
                                <m.icon className="w-4 h-4" />
                                {m.title}
                                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                            {isOpen && (
                                <div className="absolute right-0 top-full mt-0 w-64 bg-white text-slate-900 shadow-2xl border border-zinc-200 rounded-b-lg overflow-hidden animate-in slide-in-from-top-2 duration-150" data-testid={`menubar-dropdown-${m.title}`}>
                                    <div className={`h-1 bg-gradient-to-l ${m.color}`}></div>
                                    {m.items.map((it, i) => {
                                        const Icon = it.icon;
                                        const active = pathname === it.to;
                                        return (
                                            <Link
                                                key={i}
                                                to={it.to}
                                                onClick={() => setOpen(null)}
                                                className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b border-zinc-100 last:border-0 transition-all ${active ? "bg-amber-50 text-amber-900 font-bold border-r-4 border-r-amber-500" : "hover:bg-zinc-50 hover:translate-x-1"}`}
                                                data-testid={`menubar-item-${it.to.replace(/\//g, "-")}`}
                                            >
                                                <Icon className={`w-4 h-4 shrink-0 ${active ? "text-amber-600" : "text-slate-500"}`} />
                                                <span className="flex-1">{it.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
