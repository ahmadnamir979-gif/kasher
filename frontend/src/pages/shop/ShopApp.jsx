import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import AppShell, { SideLink } from "@/components/layout/AppShell";
import { LayoutDashboard, ScanBarcode, Package, ShoppingCart, Truck, Users, UserCog, Receipt, BarChart3, Wallet, Clock, Warehouse, Tag } from "lucide-react";
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
import { RenewSuccess, RenewCancel } from "@/pages/shop/Renew";

const nav = [
    { to: "/pos", icon: ScanBarcode, label: "نقطة البيع" },
    { to: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
    { to: "/products", icon: Package, label: "المنتجات والمخزون" },
    { to: "/warehouses", icon: Warehouse, label: "المخازن" },
    { to: "/barcodes", icon: Tag, label: "ملصقات الباركود" },
    { to: "/sales", icon: ShoppingCart, label: "المبيعات والمرتجعات" },
    { to: "/purchases", icon: Truck, label: "المشتريات" },
    { to: "/customers", icon: Users, label: "العملاء" },
    { to: "/suppliers", icon: Truck, label: "الموردين" },
    { to: "/employees", icon: UserCog, label: "الموظفين" },
    { to: "/expenses", icon: Wallet, label: "المصاريف" },
    { to: "/shifts", icon: Clock, label: "الورديات" },
    { to: "/reports", icon: BarChart3, label: "التقارير" },
];

function Sidebar() {
    const { pathname } = useLocation();
    return nav.map(l => <SideLink key={l.to} to={l.to} icon={l.icon} active={pathname === l.to}>{l.label}</SideLink>);
}

export default function ShopApp() {
    const { pathname } = useLocation();
    // POS is fullscreen without shell chrome
    if (pathname === "/pos") return <POS />;
    if (pathname === "/renew/success") return <RenewSuccess />;
    if (pathname === "/renew/cancel") return <RenewCancel />;
    const item = nav.find(n => n.to === pathname);
    return (
        <AppShell title={item?.label || ""} sidebar={<Sidebar />}>
            <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="warehouses" element={<Warehouses />} />
                <Route path="barcodes" element={<BarcodeLabels />} />
                <Route path="sales" element={<Sales />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="customers" element={<Customers />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="employees" element={<Employees />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="shifts" element={<Shifts />} />
                <Route path="reports" element={<Reports />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </AppShell>
    );
}
