import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import AppShell, { SideLink } from "@/components/layout/AppShell";
import { LayoutDashboard, ScanBarcode, Package, ShoppingCart, Truck, Users, UserCog, Receipt, BarChart3, Wallet, Clock, Warehouse, Tag, ArrowLeftRight, Wand2, BellRing, Settings as SettingsIcon, Book, FileText, Landmark, Percent, Lock, Target, DollarSign, ClipboardList, Calendar, Factory, AlertTriangle } from "lucide-react";
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

const nav = [
    { section: "التشغيل" },
    { to: "/pos", icon: ScanBarcode, label: "نقطة البيع" },
    { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
    { to: "/products", icon: Package, label: "المنتجات والمخزون" },
    { to: "/warehouses", icon: Warehouse, label: "المخازن" },
    { to: "/transfers", icon: ArrowLeftRight, label: "تحويلات المخزون" },
    { to: "/barcodes", icon: Tag, label: "ملصقات الباركود" },
    { to: "/expiry", icon: AlertTriangle, label: "تواريخ الصلاحية" },
    { to: "/sales", icon: ShoppingCart, label: "المبيعات والمرتجعات" },
    { to: "/purchases", icon: Truck, label: "المشتريات" },
    { to: "/orders", icon: ClipboardList, label: "الطلبيات" },
    { to: "/customers", icon: Users, label: "العملاء" },
    { to: "/reminders", icon: BellRing, label: "الديون والذمم" },
    { to: "/installments", icon: Calendar, label: "التقسيط" },
    { to: "/suppliers", icon: Truck, label: "الموردين" },
    { to: "/manufacturing", icon: Factory, label: "التصنيع" },
    { to: "/pricing-tiers", icon: Tag, label: "فئات الأسعار" },
    { section: "المحاسبة" },
    { to: "/accounts", icon: Book, label: "فهرس الحسابات" },
    { to: "/journal", icon: FileText, label: "اليومية العامة" },
    { to: "/vouchers", icon: Receipt, label: "السندات (قبض/صرف)" },
    { to: "/banks", icon: Landmark, label: "البنوك والشيكات" },
    { to: "/cost-centers", icon: Target, label: "مراكز التكلفة" },
    { to: "/currencies", icon: DollarSign, label: "العملات" },
    { to: "/vat", icon: Percent, label: "كشف الضريبة" },
    { to: "/financial-reports", icon: BarChart3, label: "التقارير المالية" },
    { to: "/closed-periods", icon: Lock, label: "الفترات المغلقة" },
    { section: "أخرى" },
    { to: "/employees", icon: UserCog, label: "الموظفين" },
    { to: "/expenses", icon: Wallet, label: "المصاريف" },
    { to: "/shifts", icon: Clock, label: "الورديات" },
    { to: "/migration", icon: Wand2, label: "نقل من نظام قديم" },
    { to: "/reports", icon: BarChart3, label: "التقارير" },
    { to: "/settings", icon: SettingsIcon, label: "الإعدادات" },
];

function Sidebar() {
    const { pathname } = useLocation();
    return nav.map((l, i) => l.section
        ? <div key={`s-${i}`} className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{l.section}</div>
        : <SideLink key={l.to} to={l.to} icon={l.icon} active={pathname === l.to}>{l.label}</SideLink>
    );
}

export default function ShopApp() {
    const { pathname } = useLocation();
    if (pathname === "/pos") return <POS />;
    if (pathname === "/renew/success") return <RenewSuccess />;
    if (pathname === "/renew/cancel") return <RenewCancel />;
    const item = nav.find(n => n.to === pathname);
    return (
        <AppShell title={item?.label || ""} sidebar={<Sidebar />}>
            <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="migration" element={<Migration />} />
                <Route path="products" element={<Products />} />
                <Route path="warehouses" element={<Warehouses />} />
                <Route path="transfers" element={<Transfers />} />
                <Route path="barcodes" element={<BarcodeLabels />} />
                <Route path="expiry" element={<ExpiryAlerts />} />
                <Route path="sales" element={<Sales />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="orders" element={<Orders />} />
                <Route path="customers" element={<Customers />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="installments" element={<Installments />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="manufacturing" element={<Manufacturing />} />
                <Route path="pricing-tiers" element={<PricingTiers />} />
                <Route path="accounts" element={<ChartOfAccounts />} />
                <Route path="journal" element={<Journal />} />
                <Route path="vouchers" element={<Vouchers />} />
                <Route path="banks" element={<BanksChecks />} />
                <Route path="cost-centers" element={<CostCenters />} />
                <Route path="currencies" element={<Currencies />} />
                <Route path="vat" element={<VatReport />} />
                <Route path="financial-reports" element={<FinancialReports />} />
                <Route path="closed-periods" element={<ClosedPeriods />} />
                <Route path="employees" element={<Employees />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </AppShell>
    );
}
