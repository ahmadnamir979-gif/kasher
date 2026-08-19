import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError, fmt } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Home, Archive, Wallet, Keyboard, RefreshCw, X, Trash2, LogOut,
    Save, Printer, ReceiptText, Gift, DollarSign, FileText, Undo2,
    Boxes, Package as PackageIcon, Search, MessageCircle
} from "lucide-react";
import { ReceiptPreview, printReceipt } from "@/components/Receipt";
import { ShiftBadge, ShiftManager } from "@/components/ShiftManager";

// Top action button (colorful, matches reference)
function TopBtn({ icon: Icon, label, onClick, color = "sky", testid }) {
    const bg = {
        sky: "bg-sky-500 hover:bg-sky-600",
        emerald: "bg-emerald-500 hover:bg-emerald-600",
        amber: "bg-amber-500 hover:bg-amber-600",
        rose: "bg-rose-500 hover:bg-rose-600",
        violet: "bg-violet-500 hover:bg-violet-600",
        orange: "bg-orange-500 hover:bg-orange-600",
        cyan: "bg-cyan-500 hover:bg-cyan-600",
    }[color];
    return (
        <button onClick={onClick} data-testid={testid} className={`${bg} text-white h-11 px-3 rounded-md flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm`}>
            <Icon className="w-4 h-4" /> {label}
        </button>
    );
}

// Bottom action button (bigger, tinted)
function ActBtn({ icon: Icon, label, onClick, color, testid, disabled }) {
    const bg = {
        sky: "bg-sky-100 hover:bg-sky-200 text-sky-900 border-sky-300",
        emerald: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300",
        amber: "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300",
        rose: "bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-300",
        violet: "bg-violet-100 hover:bg-violet-200 text-violet-900 border-violet-300",
        orange: "bg-orange-100 hover:bg-orange-200 text-orange-900 border-orange-300",
        pink: "bg-pink-100 hover:bg-pink-200 text-pink-900 border-pink-300",
        cyan: "bg-cyan-100 hover:bg-cyan-200 text-cyan-900 border-cyan-300",
    }[color];
    return (
        <button onClick={onClick} disabled={disabled} data-testid={testid}
            className={`${bg} h-16 rounded-md border flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors disabled:opacity-50`}>
            <Icon className="w-5 h-5" /> {label}
        </button>
    );
}

export default function POS() {
    const { user, logout } = useAuth();
    const nav = useNavigate();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [warehouseId, setWarehouseId] = useState("");
    const [activeCat, setActiveCat] = useState("all");
    const [q, setQ] = useState("");
    const [cart, setCart] = useState([]);
    const [discount, setDiscount] = useState(0);
    const [shift, setShift] = useState(null);
    const [shiftDlg, setShiftDlg] = useState(false);
    const [receiptOpen, setReceiptOpen] = useState(false);
    const [lastSale, setLastSale] = useState(null);
    const [returnsOpen, setReturnsOpen] = useState(false);
    const [pastSales, setPastSales] = useState([]);
    const [waPhone, setWaPhone] = useState("");
    const [waOpen, setWaOpen] = useState(false);
    const [now, setNow] = useState(new Date());
    const searchRef = useRef(null);

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    const refresh = async () => {
        const [p, c, w] = await Promise.all([api.get("/products"), api.get("/categories"), api.get("/warehouses")]);
        setProducts(p.data); setCategories(c.data); setWarehouses(w.data);
        const def = w.data.find(x => x.is_default) || w.data[0];
        if (def && !warehouseId) setWarehouseId(def.id);
    };
    const loadShift = async () => { try { const r = await api.get("/shifts/current"); setShift(r.data); } catch { setShift(null); } };
    useEffect(() => { refresh(); loadShift(); }, []);

    useEffect(() => {
        const h = (e) => {
            if (e.key === "F1") { e.preventDefault(); pay("cash"); }
            if (e.key === "F2") { e.preventDefault(); pay("card"); }
            if (e.ctrlKey && e.key.toLowerCase() === "f") { e.preventDefault(); searchRef.current?.focus(); }
            if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); setCart(c => c.slice(0, -1)); }
            if (e.key === "Escape") { setCart([]); }
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    });

    const filteredProducts = useMemo(() => {
        const t = q.trim().toLowerCase();
        return products.filter(p => (!warehouseId || !p.warehouse_id || p.warehouse_id === warehouseId) &&
            (activeCat === "all" || p.category_id === activeCat) &&
            (!t || p.name.toLowerCase().includes(t) || (p.barcode || "").includes(t)));
    }, [products, q, activeCat, warehouseId]);

    const addToCart = (p) => {
        setCart(c => {
            const idx = c.findIndex(x => x.product_id === p.id);
            if (idx >= 0) { const copy = [...c]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy; }
            return [...c, { product_id: p.id, name: p.name, price: p.sale_price, cost: p.cost_price, qty: 1, discount: 0, tax_rate: p.tax_rate || 0, stock: p.stock }];
        });
    };
    const setQty = (i, qty) => setCart(c => c.map((x, k) => k === i ? { ...x, qty: Math.max(0.001, qty) } : x));
    const removeItem = (i) => setCart(c => c.filter((_, k) => k !== i));

    const subtotal = cart.reduce((s, i) => s + i.qty * i.price - i.discount, 0);
    const tax = cart.reduce((s, i) => s + (i.qty * i.price - i.discount) * (i.tax_rate/100), 0);
    const total = subtotal + tax - discount;

    const handleBarcodeEnter = (e) => {
        if (e.key === "Enter" && q.trim()) {
            const t = q.trim().toLowerCase();
            const match = products.find(p => (p.barcode || "").toLowerCase() === t || p.name.toLowerCase() === t);
            if (match) { addToCart(match); setQ(""); }
        }
    };

    const pay = async (method) => {
        if (cart.length === 0) return toast.error("السلة فارغة");
        if (!shift) { toast.error("يرجى فتح وردية أولاً"); setShiftDlg(true); return; }
        try {
            const { data } = await api.post("/sales", {
                items: cart, discount, paid: total, payment_method: method,
                customer_name: "زبون نقدي", warehouse_id: warehouseId, is_return: false,
            });
            toast.success(`تمّ البيع • ${fmt(total)}`);
            setLastSale(data); setReceiptOpen(true);
            setCart([]); setDiscount(0);
            refresh();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const openReturns = async () => {
        const { data } = await api.get("/sales?limit=50");
        setPastSales(data.filter(s => !s.is_return));
        setReturnsOpen(true);
    };
    const doReturn = async (saleId) => {
        if (!window.confirm("تأكيد استرجاع الفاتورة كاملة؟")) return;
        try {
            const { data } = await api.post(`/sales/${saleId}/return`);
            toast.success(`تمّ إنشاء مرتجع #${data.invoice_no}`);
            setReturnsOpen(false); setLastSale(data); setReceiptOpen(true); refresh();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const catColor = (id) => categories.find(c => c.id === id)?.color || "#3b82f6";
    const lastInvoiceNo = lastSale?.invoice_no || products.length; // fallback for display
    const currentWarehouse = warehouses.find(w => w.id === warehouseId);

    const openWA = () => {
        if (!lastSale) return toast.error("لا توجد فاتورة أخيرة");
        setWaOpen(true);
    };
    const sendWA = () => {
        const phone = waPhone.replace(/\D/g, "");
        if (!phone) return toast.error("أدخل رقم صحيح");
        const shopName = user?.shop?.name || "المحل";
        const items = lastSale.items.map(it => `• ${it.name} × ${it.qty} = ${fmt(it.qty*it.price)}`).join("\n");
        const msg = `*${shopName}*\nفاتورة #${lastSale.invoice_no}\n${new Date(lastSale.created_at).toLocaleString("ar-EG")}\n\n${items}\n\n*الإجمالي: ${fmt(lastSale.total)}*\nشكراً لتسوقكم معنا 🌟`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
        setWaOpen(false); setWaPhone("");
    };

    return (
        <div className="h-screen flex flex-col bg-[#eef2f7]" dir="rtl">
            {/* Top action bar - matches reference */}
            <div className="h-14 bg-gradient-to-l from-slate-800 to-slate-900 flex items-center px-3 gap-2 shrink-0 border-b border-slate-950 shadow">
                <div className="flex items-center gap-2 pl-3 border-l border-slate-700 ml-2">
                    <div className="w-9 h-9 rounded bg-amber-400 grid place-items-center text-slate-900 font-bold">م</div>
                    <div className="text-white leading-tight">
                        <div className="text-sm font-bold">{user?.shop?.name || "POS"}</div>
                        <div className="text-[10px] text-slate-400">{user?.name} • {currentWarehouse?.name || "—"}</div>
                    </div>
                </div>
                <TopBtn icon={Home} label="الرئيسية" color="sky" onClick={() => nav("/dashboard")} testid="pos-home-btn" />
                <TopBtn icon={Archive} label="أرشيف الفواتير" color="orange" onClick={() => nav("/sales")} testid="pos-archive-btn" />
                <TopBtn icon={Wallet} label="البطاقات" color="rose" onClick={() => nav("/customers")} testid="pos-cards-btn" />
                <div className="flex-1" />
                <div className="text-white text-xs bg-slate-950/40 rounded px-3 py-1.5 border border-slate-700">
                    <div className="text-slate-400 text-[10px]">آخر فاتورة #</div>
                    <div className="tabular-nums font-bold text-amber-300">{lastSale?.invoice_no || "—"} • {fmt(lastSale?.total || 0)}</div>
                </div>
                <div className="text-white text-xs bg-slate-950/40 rounded px-3 py-1.5 border border-slate-700 flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-amber-300" />
                    <div><div className="text-slate-400 text-[10px]">اختصارات</div><div className="font-bold">F1 نقد • F2 بطاقة</div></div>
                </div>
                <ShiftBadge shift={shift} onOpen={() => setShiftDlg(true)} onClose={() => setShiftDlg(true)} />
                <TopBtn icon={RefreshCw} label="تحديث" color="emerald" onClick={refresh} testid="pos-refresh-btn" />
                <div className="text-white text-xs bg-slate-950/40 rounded px-3 py-1.5 border border-slate-700 tabular-nums">
                    <div className="text-slate-400 text-[10px]">{now.toLocaleDateString("en-GB")}</div>
                    <div className="font-bold">{now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <button onClick={async () => { await logout(); nav("/login"); }} data-testid="pos-logout-btn"
                    className="h-11 px-3 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center gap-2"><LogOut className="w-4 h-4" /> خروج</button>
            </div>

            {/* Main 3-column layout */}
            <div className="flex-1 flex overflow-hidden p-2 gap-2">
                {/* LEFT column - Payment / info panel */}
                <aside className="w-[190px] shrink-0 flex flex-col gap-2">
                    <div className="bg-white border border-zinc-300 rounded-md p-3">
                        <div className="text-[11px] text-slate-500 mb-1">طريقة الدفع</div>
                        <div className="text-sm font-bold text-slate-900">مبيعات نقدية</div>
                    </div>
                    <div className="bg-white border border-zinc-300 rounded-md p-3">
                        <div className="text-[11px] text-slate-500 mb-1">الزبون</div>
                        <div className="text-sm font-medium text-slate-800">زبون نقدي</div>
                    </div>
                    <button onClick={() => setCart(c => c.slice(0, -1))} className="bg-white hover:bg-emerald-50 border-2 border-emerald-300 rounded-md p-3 flex flex-col items-center gap-1 text-emerald-800 transition-colors" data-testid="undo-btn">
                        <div className="w-9 h-9 rounded-full bg-emerald-500 text-white grid place-items-center"><Undo2 className="w-5 h-5" /></div>
                        <div className="text-[11px] font-semibold">تراجع</div>
                        <kbd className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5">Ctrl+Z</kbd>
                    </button>
                    <button onClick={() => searchRef.current?.focus()} className="bg-white hover:bg-rose-50 border-2 border-rose-300 rounded-md p-3 flex flex-col items-center gap-1 text-rose-800 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-rose-500 text-white grid place-items-center"><Search className="w-5 h-5" /></div>
                        <div className="text-[11px] font-semibold">بحث</div>
                        <kbd className="bg-rose-100 text-rose-900 border border-rose-300 px-1.5">Ctrl+F</kbd>
                    </button>
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-md p-3 flex-1 flex flex-col">
                        <div className="text-[10px] text-emerald-700 font-semibold uppercase mb-2">تفاصيل الصنف</div>
                        {cart.length > 0 ? (() => {
                            const it = cart[cart.length - 1];
                            return (
                                <div className="space-y-1.5 text-xs">
                                    <div><div className="text-slate-500 text-[10px]">الاسم</div><div className="font-semibold truncate">{it.name}</div></div>
                                    <div><div className="text-slate-500 text-[10px]">الكمية</div><div className="tabular-nums font-bold text-lg">{it.qty}</div></div>
                                    <div><div className="text-slate-500 text-[10px]">السعر</div><div className="tabular-nums font-semibold">{fmt(it.price)}</div></div>
                                    <div><div className="text-slate-500 text-[10px]">الرصيد بعد</div><div className="tabular-nums">{(it.stock || 0) - it.qty}</div></div>
                                </div>
                            );
                        })() : (
                            <div className="text-[11px] text-emerald-700/70 mt-4 text-center">اختر منتجاً لعرض التفاصيل</div>
                        )}
                    </div>
                </aside>

                {/* MIDDLE column - Invoice/Cart */}
                <section className="flex-1 min-w-0 bg-white border border-zinc-300 rounded-md flex flex-col overflow-hidden">
                    <div className="h-11 bg-gradient-to-l from-slate-100 to-white border-b border-zinc-300 flex items-center gap-2 px-3">
                        <div className="text-xs bg-emerald-500 text-white px-2.5 py-1 rounded font-semibold">مبيعات</div>
                        <div className="text-xs bg-zinc-100 text-slate-700 px-2.5 py-1 rounded border border-zinc-200">مبيعات نقدية</div>
                        <div className="flex-1 relative">
                            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={handleBarcodeEnter}
                                placeholder="ابحث بالباركود أو اسم الصنف..."
                                data-testid="pos-search-input" className="h-8 pr-7 text-sm bg-yellow-50 border-yellow-200 focus-visible:ring-yellow-400" autoFocus />
                        </div>
                        {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded flex items-center gap-1"><X className="w-3 h-3" /> إفراغ</button>}
                    </div>
                    <div className="grid grid-cols-[40px_1fr_80px_60px_80px_100px_60px] bg-slate-800 text-white text-[11px] font-semibold">
                        <div className="p-1.5 text-center">#</div>
                        <div className="p-1.5">اسم الصنف</div>
                        <div className="p-1.5 text-center">الكمية</div>
                        <div className="p-1.5 text-center">×</div>
                        <div className="p-1.5 text-center">السعر</div>
                        <div className="p-1.5 text-center">المجموع</div>
                        <div className="p-1.5"></div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {cart.length === 0 && <div className="p-12 text-center text-slate-400 text-sm">ابدأ بمسح الباركود أو اضغط منتجاً من الشبكة على اليسار</div>}
                        {cart.map((it, i) => (
                            <div key={i} data-testid={`cart-item-${i}`} className={`grid grid-cols-[40px_1fr_80px_60px_80px_100px_60px] items-center text-sm border-b border-zinc-200 ${i % 2 ? "bg-white" : "bg-blue-50/40"}`}>
                                <div className="p-2 text-center text-slate-500 tabular-nums">{i + 1}</div>
                                <div className="p-2">
                                    <div className="font-medium text-slate-900 truncate">{it.name}</div>
                                    <div className="text-[11px] text-slate-500">الرصيد: <span className="tabular-nums">{it.stock || 0}</span> • خصم {(it.discount || 0)}%</div>
                                </div>
                                <div className="p-1">
                                    <input type="number" value={it.qty} onChange={(e) => setQty(i, +e.target.value || 1)}
                                        className="w-full h-8 text-center border border-zinc-300 rounded bg-white tabular-nums font-bold" />
                                </div>
                                <div className="p-2 text-center text-slate-400">×</div>
                                <div className="p-2 text-center tabular-nums">{fmt(it.price)}</div>
                                <div className="p-2 text-center tabular-nums font-bold text-emerald-700">{fmt(it.qty * it.price)}</div>
                                <div className="p-1 text-center">
                                    <button onClick={() => removeItem(i)} className="text-rose-500 hover:bg-rose-100 p-1.5 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Totals footer */}
                    <div className="border-t-2 border-slate-800 bg-slate-100 p-3">
                        <div className="grid grid-cols-4 gap-3 items-end">
                            <div>
                                <div className="text-[10px] text-slate-600 mb-1">ملاحظات</div>
                                <input placeholder="…" className="w-full h-8 rounded border border-zinc-300 bg-white px-2 text-xs" />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-600 mb-1">خصم</div>
                                <Input type="number" value={discount} onChange={(e) => setDiscount(+e.target.value || 0)}
                                    data-testid="discount-input" className="h-8 text-right tabular-nums bg-white" />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-600 mb-1">المجموع</div>
                                <div className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm font-semibold tabular-nums flex items-center justify-end">{fmt(subtotal + tax)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-900 font-bold mb-1">الإجمالي</div>
                                <div className="h-10 rounded bg-slate-900 text-amber-300 px-3 text-xl font-black tabular-nums flex items-center justify-end shadow-inner">{fmt(total)}</div>
                            </div>
                        </div>
                    </div>
                    {/* Bottom action buttons - matches reference */}
                    <div className="grid grid-cols-8 gap-1.5 p-2 bg-white border-t border-zinc-200">
                        <ActBtn icon={Save} label="حفظ الفاتورة" color="sky" onClick={() => pay("cash")} testid="pay-cash-btn" />
                        <ActBtn icon={Printer} label="طباعة الفاتورة" color="cyan" onClick={() => lastSale && printReceipt("receipt-print-area")} testid="print-last-btn" />
                        <ActBtn icon={ReceiptText} label="طباعة آخر فاتورة" color="pink" onClick={() => lastSale ? setReceiptOpen(true) : toast.error("لا توجد فاتورة سابقة")} />
                        <ActBtn icon={Gift} label="وصل هدية" color="rose" onClick={() => toast.info("قريباً")} />
                        <ActBtn icon={DollarSign} label="تفاصيل الدفع" color="violet" onClick={() => pay("card")} testid="pay-card-btn" />
                        <ActBtn icon={FileText} label="عرض سعر" color="amber" onClick={() => toast.info("قريباً")} />
                        <ActBtn icon={Undo2} label="فاتورة مردودات" color="orange" onClick={openReturns} testid="open-returns-btn" />
                        <ActBtn icon={MessageCircle} label="واتساب للزبون" color="emerald" onClick={openWA} testid="whatsapp-btn" />
                    </div>
                </section>

                {/* RIGHT column - Categories + Product grid */}
                <aside className="w-[380px] shrink-0 flex flex-col gap-2 bg-white border border-zinc-300 rounded-md p-2 overflow-hidden">
                    {/* Warehouse selector */}
                    {warehouses.length > 1 && (
                        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} data-testid="pos-warehouse-select"
                            className="h-8 rounded border border-zinc-300 bg-white px-2 text-xs font-medium">
                            {warehouses.map(w => <option key={w.id} value={w.id}>📦 {w.name}</option>)}
                        </select>
                    )}
                    {/* Category tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        <button onClick={() => setActiveCat("all")} className={`px-3 h-8 text-xs rounded whitespace-nowrap font-semibold transition-colors ${activeCat === "all" ? "bg-slate-800 text-white" : "bg-zinc-100 hover:bg-zinc-200 text-slate-800"}`}>المفضلة</button>
                        {categories.map(c => (
                            <button key={c.id} onClick={() => setActiveCat(c.id)}
                                className={`px-3 h-8 text-xs rounded whitespace-nowrap font-semibold transition-colors ${activeCat === c.id ? "text-white" : "bg-zinc-100 hover:bg-zinc-200 text-slate-800"}`}
                                style={activeCat === c.id ? { backgroundColor: c.color } : {}}>{c.name}</button>
                        ))}
                    </div>
                    {/* Product grid - 3 columns like reference */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center text-slate-400 pt-10 text-xs">
                                <PackageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <div>لا توجد منتجات</div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-1.5">
                                {filteredProducts.map(p => (
                                    <button key={p.id} onClick={() => addToCart(p)} data-testid={`pos-product-${p.id}`}
                                        className="pos-card bg-white border-2 border-zinc-200 hover:border-blue-500 hover:shadow-md rounded p-2 text-right transition-all">
                                        <div className="h-10 rounded mb-1.5 grid place-items-center text-xl font-bold text-white" style={{ backgroundColor: catColor(p.category_id) }}>{p.name.charAt(0)}</div>
                                        <div className="text-[11px] font-semibold text-slate-900 leading-tight line-clamp-2 min-h-[26px]">{p.name}</div>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[10px] text-slate-500 tabular-nums">{p.stock}</span>
                                            <span className="text-[11px] font-bold text-blue-700 tabular-nums bg-blue-50 rounded px-1.5">{fmt(p.sale_price)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* Bottom status bar */}
            <div className="h-8 bg-slate-800 text-white text-xs flex items-center px-3 gap-6 tabular-nums shrink-0">
                <span>الموظف <b className="text-amber-300">{user?.name}</b></span>
                <span>الصندوق <b className="text-amber-300">{shift ? "مفتوح" : "مغلق"}</b></span>
                <span>المخزن <b className="text-amber-300">{currentWarehouse?.name || "—"}</b></span>
                <div className="flex-1" />
                <span>عدد الأصناف في السلة: <b className="text-amber-300">{cart.length}</b></span>
            </div>

            <ShiftManager open={shiftDlg} onOpenChange={setShiftDlg} shift={shift} onDone={loadShift} />

            {/* Receipt modal */}
            <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
                <DialogContent dir="rtl" className="bg-white max-w-md">
                    <DialogHeader><DialogTitle>{lastSale?.is_return ? "إيصال مرتجع" : "تمّ حفظ الفاتورة"}</DialogTitle></DialogHeader>
                    <div className="flex justify-center bg-zinc-100 p-4 rounded">
                        <div id="receipt-print-area">
                            <ReceiptPreview shop={user?.shop} sale={lastSale} cashierName={user?.name} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReceiptOpen(false)} data-testid="receipt-close-btn">إغلاق</Button>
                        <Button onClick={() => { setReceiptOpen(false); setWaOpen(true); }} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><MessageCircle className="w-4 h-4" /> واتساب</Button>
                        <Button onClick={() => printReceipt("receipt-print-area")} data-testid="print-receipt-btn" className="bg-slate-900 hover:bg-slate-800 text-white gap-2"><Printer className="w-4 h-4" /> طباعة</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Returns dialog */}
            <Dialog open={returnsOpen} onOpenChange={setReturnsOpen}>
                <DialogContent dir="rtl" className="bg-white max-w-3xl">
                    <DialogHeader><DialogTitle>إرجاع فاتورة</DialogTitle></DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 sticky top-0"><tr className="text-right text-xs text-slate-600"><th className="p-2">رقم</th><th className="p-2">التاريخ</th><th className="p-2">الزبون</th><th className="p-2">الإجمالي</th><th></th></tr></thead>
                            <tbody>
                                {pastSales.map(s => (
                                    <tr key={s.id} className="border-b" data-testid={`return-row-${s.id}`}>
                                        <td className="p-2 tabular-nums font-mono">#{s.invoice_no}</td>
                                        <td className="p-2 tabular-nums text-slate-600">{s.created_at?.substring(0,16).replace("T"," ")}</td>
                                        <td className="p-2">{s.customer_name}</td>
                                        <td className="p-2 tabular-nums font-bold">{fmt(s.total)}</td>
                                        <td className="p-2"><Button size="sm" onClick={() => doReturn(s.id)} className="bg-rose-600 hover:bg-rose-700 text-white gap-1"><Undo2 className="w-3.5 h-3.5" /> إرجاع</Button></td>
                                    </tr>
                                ))}
                                {pastSales.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">لا توجد فواتير قابلة للإرجاع</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* WhatsApp dialog */}
            <Dialog open={waOpen} onOpenChange={setWaOpen}>
                <DialogContent dir="rtl" className="bg-white">
                    <DialogHeader><DialogTitle>إرسال الفاتورة عبر واتساب</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm">رقم الواتساب (مع رمز الدولة)</label>
                        <Input value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="970591234567" data-testid="wa-phone-input" className="tabular-nums" />
                        <p className="text-xs text-slate-500">مثال: 970591234567 (بدون + أو 00)</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWaOpen(false)}>إلغاء</Button>
                        <Button onClick={sendWA} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="wa-send-btn"><MessageCircle className="w-4 h-4" /> فتح واتساب</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
