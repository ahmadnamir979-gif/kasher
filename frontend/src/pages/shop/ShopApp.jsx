import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import AppShell, { SideLink } from "@/components/layout/AppShell";
import { LayoutDashboard, ScanBarcode, Package, ShoppingCart, Truck, Users, UserCog, Receipt, BarChart3, Wallet, Clock, Warehouse, Tag, ArrowLeftRight, Wand2, BellRing, Settings as SettingsIcon, Book, FileText, Landmark, Percent, Lock, Target, DollarSign, ClipboardList, Calendar, Factory, AlertTriangle, Building2, Hash, Calculator, ClipboardCheck, Repeat, FileSpreadsheet, Sparkles, Activity, Archive, Scale, HandCoins, Send, Gift, Star, Shield, PieChart, FolderOpen, ChevronLeft, TrendingUp } from "lucide-react";
import POS from "@/pages/shop/POS";
import Products from "@/pages/shop/Products";
import Sales from "@/pages/shop/Sales";
import Purchases from "@/pages/shop/Purchases";
import Customers from "@/pages/shop/Customers";
import Suppliers from "@/pages/shop/Suppliers";
import Employees from "@/pages/shop/Employees";
import Expenses from "@/pages/shop/Expenses";
import Reports from "@/pages/shop/Reports";
import Dashboard from "@/pages/shop/Dashboard";
import Shifts from "@/pages/shop/Shifts";
import Warehouses from "@/pages/shop/Warehouses";
import BarcodeLabels from "@/pages/shop/BarcodeLabels";
import Transfers from "@/pages/shop/Transfers";
import Migration from "@/pages/shop/Migration";
import Reminders from "@/pages/shop/Reminders";
import Settings from "@/pages/shop/Settings";
import AuditLog from "@/pages/shop/AuditLog";
import { RenewSuccess, RenewCancel } from "@/pages/shop/Renew";
import ChartOfAccounts from "@/pages/shop/accounting/ChartOfAccounts";
import Journal from "@/pages/shop/accounting/Journal";
import Vouchers from "@/pages/shop/accounting/Vouchers";
import BanksChecks from "@/pages/shop/accounting/BanksChecks";
import VatReport from "@/pages/shop/accounting/VatReport";
import FinancialReports from "@/pages/shop/accounting/FinancialReports";
import ClosedPeriods from "@/pages/shop/accounting/ClosedPeriods";
import CostCenters from "@/pages/shop/accounting/CostCenters";
import Currencies from "@/pages/shop/accounting/Currencies";
import Orders from "@/pages/shop/accounting/Orders";
import Installments from "@/pages/shop/accounting/Installments";
import PricingTiers from "@/pages/shop/accounting/PricingTiers";
import Manufacturing from "@/pages/shop/accounting/Manufacturing";
import ExpiryAlerts from "@/pages/shop/accounting/ExpiryAlerts";
import Ledger from "@/pages/shop/accounting/Ledger";
import FixedAssets from "@/pages/shop/accounting/FixedAssets";
import NumberingRule from "@/pages/shop/inventory/NumberingRule";
import BulkPrice from "@/pages/shop/inventory/BulkPrice";
import InventoryAdjustments from "@/pages/shop/inventory/InventoryAdjustments";
import Alternatives from "@/pages/shop/inventory/Alternatives";
import ExcelLive from "@/pages/shop/inventory/ExcelLive";
import ProductMovement from "@/pages/shop/inventory/ProductMovement";
import DeadStock from "@/pages/shop/inventory/DeadStock";
import CustomerStatement from "@/pages/shop/accounting/CustomerStatement";
import SupplierStatement from "@/pages/shop/accounting/SupplierStatement";
import Cashbox from "@/pages/shop/accounting/Cashbox";
import BalanceSheet from "@/pages/shop/accounting/BalanceSheet";
import Promotions from "@/pages/shop/sales/Promotions";
import Loyalty from "@/pages/shop/sales/Loyalty";
import AIAssistant from "@/pages/shop/AIAssistant";
import { useState } from "react";

// Grouped navigation sections (Al-Arabi style, collapsible)
const SECTIONS = [
    {
        key: "home", title: "الرئيسية", icon: LayoutDashboard, color: "from-blue-500/30 to-blue-500/5",
        items: [
            { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
            { to: "/pos", icon: ScanBarcode, label: "نقطة البيع (POS)" },
            { to: "/assistant", icon: Sparkles, label: "المساعد الذكي" },
        ],
    },
    {
        key: "sales", title: "المبيعات والعملاء", icon: ShoppingCart, color: "from-emerald-500/30 to-emerald-500/5",
        items: [
            { to: "/sales", icon: ShoppingCart, label: "فواتير المبيعات" },
            { to: "/customers", icon: Users, label: "العملاء" },
            { to: "/customer-statement", icon: HandCoins, label: "كشف حساب / تحصيل" },
            { to: "/reminders", icon: BellRing, label: "الديون والذمم" },
            { to: "/installments", icon: Calendar, label: "التقسيط" },
            { to: "/promotions", icon: Gift, label: "العروض والخصومات" },
            { to: "/loyalty", icon: Star, label: "نقاط الولاء" },
            { to: "/pricing-tiers", icon: Tag, label: "فئات الأسعار" },
        ],
    },
    {
        key: "purchases", title: "المشتريات والموردين", icon: Truck, color: "from-indigo-500/30 to-indigo-500/5",
        items: [
            { to: "/purchases", icon: Truck, label: "فواتير المشتريات" },
            { to: "/orders", icon: ClipboardList, label: "طلبيات الشراء" },
            { to: "/suppliers", icon: Truck, label: "الموردين" },
            { to: "/supplier-statement", icon: Send, label: "كشف حساب / تسديد" },
        ],
    },
    {
        key: "inventory", title: "المخزون", icon: Warehouse, color: "from-amber-500/30 to-amber-500/5",
        items: [
            { to: "/products", icon: Package, label: "الأصناف والمخزون" },
            { to: "/product-numbering", icon: Hash, label: "ترقيم الأصناف" },
            { to: "/bulk-price", icon: Calculator, label: "معالجة الأسعار" },
            { to: "/alternatives", icon: Repeat, label: "بدائل الأصناف" },
            { to: "/inventory-adjustments", icon: ClipboardCheck, label: "ضبط المخازن (الجرد)" },
            { to: "/warehouses", icon: Warehouse, label: "المستودعات" },
            { to: "/transfers", icon: ArrowLeftRight, label: "التحويلات" },
            { to: "/product-movement", icon: Activity, label: "حركة الصنف (كاردكس)" },
            { to: "/dead-stock", icon: Archive, label: "الأصناف الراكدة" },
            { to: "/expiry", icon: AlertTriangle, label: "تواريخ الصلاحية" },
            { to: "/barcodes", icon: Tag, label: "ملصقات الباركود" },
            { to: "/manufacturing", icon: Factory, label: "التصنيع" },
        ],
    },
    {
        key: "accounting", title: "الحسابات", icon: Book, color: "from-purple-500/30 to-purple-500/5",
        items: [
            { to: "/accounts", icon: Book, label: "دليل الحسابات" },
            { to: "/journal", icon: FileText, label: "اليومية العامة" },
            { to: "/ledger", icon: Book, label: "دفتر الأستاذ" },
            { to: "/vouchers", icon: Receipt, label: "السندات (قبض/صرف)" },
            { to: "/cashbox", icon: Wallet, label: "الصندوق والبنك" },
            { to: "/banks", icon: Landmark, label: "البنوك والشيكات" },
            { to: "/fixed-assets", icon: Building2, label: "الأصول الثابتة" },
            { to: "/cost-centers", icon: Target, label: "مراكز التكلفة" },
            { to: "/currencies", icon: DollarSign, label: "العملات" },
            { to: "/closed-periods", icon: Lock, label: "الفترات المغلقة" },
        ],
    },
    {
        key: "reports", title: "التقارير", icon: BarChart3, color: "from-rose-500/30 to-rose-500/5",
        items: [
            { to: "/reports", icon: BarChart3, label: "مركز التقارير" },
            { to: "/financial-reports", icon: PieChart, label: "التقارير المالية" },
            { to: "/balance-sheet", icon: Scale, label: "الميزانية العمومية" },
            { to: "/vat", icon: Percent, label: "كشف الضريبة (VAT)" },
            { to: "/excel-live", icon: FileSpreadsheet, label: "ربط Excel مباشر" },
        ],
    },
    {
        key: "admin", title: "الإدارة", icon: UserCog, color: "from-cyan-500/30 to-cyan-500/5",
        items: [
            { to: "/employees", icon: UserCog, label: "الموظفين والصلاحيات" },
            { to: "/expenses", icon: Wallet, label: "المصاريف" },
            { to: "/shifts", icon: Clock, label: "الورديات" },
            { to: "/audit-log", icon: Shield, label: "سجل العمليات" },
        ],
    },
    {
        key: "system", title: "النظام", icon: SettingsIcon, color: "from-slate-500/30 to-slate-500/5",
        items: [
            { to: "/settings", icon: SettingsIcon, label: "الإعدادات" },
            { to: "/migration", icon: Wand2, label: "نقل من نظام قديم" },
        ],
    },
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items);

function Sidebar() {
    const { pathname } = useLocation();
    const [collapsed, setCollapsed] = useState({});
    const toggle = (k) => setCollapsed(c => ({ ...c, [k]: !c[k] }));
    return (
        <>
            {SECTIONS.map((s) => {
                const isCollapsed = collapsed[s.key];
                const SIcon = s.icon;
                return (
                    <div key={s.key} className="mb-1">
                        <button onClick={() => toggle(s.key)}
                            className={`w-full mx-2 mt-3 px-3 py-2 rounded flex items-center justify-between bg-gradient-to-l ${s.color} border-r-2 border-amber-400 text-amber-200 font-bold text-[11px] uppercase tracking-wider hover:border-amber-300 transition`}
                            data-testid={`section-${s.key}`}>
                            <span className="flex items-center gap-2"><SIcon className="w-3.5 h-3.5" /> {s.title}</span>
                            <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "" : "-rotate-90"}`} />
                        </button>
                        {!isCollapsed && s.items.map(it => (
                            <SideLink key={it.to} to={it.to} icon={it.icon} active={pathname === it.to}>{it.label}</SideLink>
                        ))}
                    </div>
                );
            })}
        </>
    );
}

export default function ShopApp() {
    const { pathname } = useLocation();
    if (pathname === "/pos") return <POS />;
    if (pathname === "/renew/success") return <RenewSuccess />;
    if (pathname === "/renew/cancel") return <RenewCancel />;
    const item = ALL_ITEMS.find(n => n.to === pathname);
    return (
        <AppShell title={item?.label || ""} sidebar={<Sidebar />}>
            <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="assistant" element={<AIAssistant />} />
                <Route path="migration" element={<Migration />} />
                <Route path="products" element={<Products />} />
                <Route path="product-numbering" element={<NumberingRule />} />
                <Route path="bulk-price" element={<BulkPrice />} />
                <Route path="alternatives" element={<Alternatives />} />
                <Route path="inventory-adjustments" element={<InventoryAdjustments />} />
                <Route path="warehouses" element={<Warehouses />} />
                <Route path="transfers" element={<Transfers />} />
                <Route path="product-movement" element={<ProductMovement />} />
                <Route path="dead-stock" element={<DeadStock />} />
                <Route path="barcodes" element={<BarcodeLabels />} />
                <Route path="expiry" element={<ExpiryAlerts />} />
                <Route path="sales" element={<Sales />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="orders" element={<Orders />} />
                <Route path="customers" element={<Customers />} />
                <Route path="customer-statement" element={<CustomerStatement />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="installments" element={<Installments />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="supplier-statement" element={<SupplierStatement />} />
                <Route path="promotions" element={<Promotions />} />
                <Route path="loyalty" element={<Loyalty />} />
                <Route path="manufacturing" element={<Manufacturing />} />
                <Route path="pricing-tiers" element={<PricingTiers />} />
                <Route path="accounts" element={<ChartOfAccounts />} />
                <Route path="journal" element={<Journal />} />
                <Route path="ledger" element={<Ledger />} />
                <Route path="vouchers" element={<Vouchers />} />
                <Route path="banks" element={<BanksChecks />} />
                <Route path="cashbox" element={<Cashbox />} />
                <Route path="fixed-assets" element={<FixedAssets />} />
                <Route path="cost-centers" element={<CostCenters />} />
                <Route path="currencies" element={<Currencies />} />
                <Route path="vat" element={<VatReport />} />
                <Route path="financial-reports" element={<FinancialReports />} />
                <Route path="balance-sheet" element={<BalanceSheet />} />
                <Route path="closed-periods" element={<ClosedPeriods />} />
                <Route path="excel-live" element={<ExcelLive />} />
                <Route path="employees" element={<Employees />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="audit-log" element={<AuditLog />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </AppShell>
    );
}
