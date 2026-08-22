import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError, isNetworkError, fmt } from "@/lib/api";
import { cache, queue } from "@/lib/offline";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Home, Archive, Wallet, Keyboard, RefreshCw, X, Trash2, LogOut,
    Save, Printer, ReceiptText, Gift, DollarSign, FileText, Undo2,
    Boxes, Package as PackageIcon, Search, MessageCircle, PauseCircle, PlayCircle,
    UserPlus, HandCoins, Delete
} from "lucide-react";
import { ReceiptPreview, printReceipt } from "@/components/Receipt";
import { ShiftBadge, ShiftManager } from "@/components/ShiftManager";
import { OfflineBadge } from "@/components/OfflineBadge";

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
    const [debtDlg, setDebtDlg] = useState(null); // {open, search, newName, newPhone, picked}
    const [debtors, setDebtors] = useState([]);
    const [held, setHeld] = useState([]);
    const [heldOpen, setHeldOpen] = useState(false);
    const [heldPrintPreview, setHeldPrintPreview] = useState(null);
    const [quickAdd, setQuickAdd] = useState(null);
    const [now, setNow] = useState(new Date());
    const searchRef = useRef(null);

    // Recent-categories usage tracker (per shop)
    const usageKey = `pos_cat_usage_${user?.shop_id || "x"}`;
    const [catUsage, setCatUsage] = useState(() => {
        try { return JSON.parse(localStorage.getItem(usageKey) || "{}"); } catch { return {}; }
    });
    const bumpCategory = (cid) => {
        if (!cid) return;
        setCatUsage(prev => {
            const next = { ...prev, [cid]: (prev[cid] || 0) + 1 };
            try { localStorage.setItem(usageKey, JSON.stringify(next)); } catch {}
            return next;
        });
    };
    const sortedCategories = useMemo(() => {
        return [...categories].sort((a, b) => (catUsage[b.id] || 0) - (catUsage[a.id] || 0) || a.name.localeCompare(b.name, "ar"));
    }, [categories, catUsage]);
    const topCategories = useMemo(() => sortedCategories.filter(c => catUsage[c.id]).slice(0, 3), [sortedCategories, catUsage]);

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    const shopId = user?.shop_id;
    const [syncing, setSyncing] = useState(false);

    const applyData = (p, c, w, h) => {
        setProducts(p); setCategories(c); setWarehouses(w); setHeld(h || []);
        const def = w.find(x => x.is_default) || w[0];
        if (def && !warehouseId) setWarehouseId(def.id);
    };

    const loadFromCache = () => {
        const p = cache.load(shopId, "products");
        const c = cache.load(shopId, "categories");
        const w = cache.load(shopId, "warehouses");
        const h = cache.load(shopId, "held");
        if (p && c && w) {
            applyData(p.data, c.data, w.data, h?.data || []);
            return true;
        }
        return false;
    };

    const refresh = async () => {
        try {
            const [p, c, w, h] = await Promise.all([api.get("/products"), api.get("/categories"), api.get("/warehouses"), api.get("/held-invoices")]);
            applyData(p.data, c.data, w.data, h.data);
            cache.save(shopId, "products", p.data);
            cache.save(shopId, "categories", c.data);
            cache.save(shopId, "warehouses", w.data);
            cache.save(shopId, "held", h.data);
        } catch (e) {
            if (isNetworkError(e)) {
                const ok = loadFromCache();
                if (ok) toast.warning("لا يوجد إنترنت — تم التحميل من الذاكرة المحلية");
                else toast.error("لا يوجد إنترنت ولا توجد نسخة محلية");
            } else {
                toast.error(formatApiError(e));
            }
        }
    };
    const loadShift = async () => {
        try {
            const r = await api.get("/shifts/current");
            setShift(r.data);
            cache.save(shopId, "shift", r.data);
        } catch (e) {
            if (isNetworkError(e)) {
                const c = cache.load(shopId, "shift");
                setShift(c?.data || null);
            } else { setShift(null); }
        }
    };
    useEffect(() => { if (shopId) { refresh(); loadShift(); } }, [shopId]);

    // Sync offline sale queue
    const syncQueue = async () => {
        if (!shopId) return;
        const items = queue.all(shopId);
        if (items.length === 0) return;
        setSyncing(true);
        let ok = 0, fail = 0;
        for (const it of items) {
            try {
                await api.post("/sales", it.payload);
                queue.remove(shopId, it.id);
                ok++;
            } catch (e) {
                if (isNetworkError(e)) break; // stop; still offline
                queue.updateError(shopId, it.id, formatApiError(e));
                fail++;
            }
        }
        setSyncing(false);
        if (ok > 0) { toast.success(`تمّت مزامنة ${ok} فاتورة`); refresh(); }
        if (fail > 0) toast.error(`فشلت ${fail} فاتورة — راجع الطابور`);
    };

    // Auto-sync on reconnect
    useEffect(() => {
        if (!shopId) return;
        const onOnline = () => syncQueue();
        window.addEventListener("online", onOnline);
        // also try syncing on mount
        if (navigator.onLine) syncQueue();
        return () => window.removeEventListener("online", onOnline);
    }, [shopId]);

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
            if (match) { addToCart(match); setQ(""); return; }
            // Unknown barcode/name — offer quick add
            if (/^\d{6,}$/.test(t)) {
                setQuickAdd({ barcode: t, name: "", category_id: "", sale_price: "", cost_price: "", stock: 1 });
                setQ("");
            }
        }
    };

    const submitQuickAdd = async () => {
        if (!quickAdd.name.trim() || !quickAdd.sale_price) return toast.error("الاسم والسعر إجباريان");
        try {
            const { data } = await api.post("/products", {
                name: quickAdd.name.trim(),
                barcode: quickAdd.barcode,
                category_id: quickAdd.category_id || null,
                warehouse_id: warehouseId || null,
                cost_price: +quickAdd.cost_price || 0,
                sale_price: +quickAdd.sale_price,
                stock: +quickAdd.stock || 1,
                min_stock: 0, unit: "قطعة", tax_rate: 0, is_active: true,
            });
            toast.success(`تمّت الإضافة: ${data.name}`);
            bumpCategory(quickAdd.category_id);
            addToCart(data);
            setQuickAdd(null);
            const pd = await api.get("/products"); setProducts(pd.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const pay = async (method, opts = {}) => {
        if (cart.length === 0) return toast.error("السلة فارغة");
        if (!shift) { toast.error("يرجى فتح وردية أولاً"); setShiftDlg(true); return; }
        const payload = {
            items: cart, discount, paid: opts.paid ?? total, payment_method: method,
            customer_id: opts.customer_id || null,
            customer_name: opts.customer_name || "زبون نقدي",
            warehouse_id: warehouseId, is_return: false,
        };
        try {
            const { data } = await api.post("/sales", payload);
            toast.success(method === "credit" ? `تمّ ترحيل الفاتورة على دين ${opts.customer_name}` : `تمّ البيع • ${fmt(total)}`);
            setLastSale(data); setReceiptOpen(true);
            setCart([]); setDiscount(0);
            refresh();
        } catch (e) {
            if (isNetworkError(e)) {
                // Save locally, generate a temporary receipt so cashier can print
                const item = queue.add(shopId, payload);
                const offlineSale = {
                    ...payload,
                    id: item.id,
                    invoice_no: `OFF-${item.id.slice(4, 12)}`,
                    total,
                    subtotal,
                    tax,
                    created_at: item.created_at,
                    cashier_name: user?.name,
                    is_offline: true,
                };
                setLastSale(offlineSale);
                setReceiptOpen(true);
                setCart([]); setDiscount(0);
                toast.warning("لا يوجد إنترنت — تمّ حفظ الفاتورة محلياً وستُرفع تلقائياً");
            } else {
                toast.error(formatApiError(e));
            }
        }
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

    const holdCart = async () => {
        if (cart.length === 0) return toast.error("السلة فارغة");
        try {
            await api.post("/held-invoices", { items: cart, discount, warehouse_id: warehouseId, customer_name: "زبون نقدي" });
            toast.success("تمّ تعليق الفاتورة");
            setCart([]); setDiscount(0);
            refresh();
        } catch (e) { toast.error(formatApiError(e)); }
    };
    const resumeHeld = async (h) => {
        if (cart.length > 0 && !window.confirm("سيتم استبدال السلة الحالية. متابعة؟")) return;
        setCart(h.items.map(i => ({ ...i, stock: i.stock || 0 })));
        setDiscount(h.discount || 0);
        setHeldOpen(false);
        await api.delete(`/held-invoices/${h.id}`);
        refresh();
        toast.success("تمّ استئناف الفاتورة");
    };
    const deleteHeld = async (h) => {
        if (!window.confirm("حذف الفاتورة المعلّقة؟")) return;
        await api.delete(`/held-invoices/${h.id}`);
        refresh();
    };
    const printHeld = (h) => {
        setHeldPrintPreview(h);
        setTimeout(() => printReceipt("held-print-area"), 100);
    };
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
        const msg = `*${shopName}*\nفاتورة #${lastSale.invoice_no}\n${new Date(lastSale.created_at).toLocaleString("en-GB")}\n\n${items}\n\n*الإجمالي: ${fmt(lastSale.total)}*\nشكراً لتسوقكم معنا 🌟`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
        toast.success("تمّ فتح واتساب — النافذة مفتوحة لتصحيح الرقم إن لزم");
    };

    // ---- Credit sale (ترحيل دين) ----
    useEffect(() => {
        if (!debtDlg?.open) return;
        (async () => {
            try { const { data } = await api.get("/customers"); setDebtors(data); }
            catch (e) { toast.error(formatApiError(e)); }
        })();
    }, [debtDlg?.open]);

    const filteredDebtors = useMemo(() => {
        if (!debtDlg) return [];
        const q = (debtDlg.search || "").trim().toLowerCase();
        return debtors
            .filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q))
            .sort((a, b) => (b.balance || 0) - (a.balance || 0));
    }, [debtors, debtDlg]);

    const confirmCreditSale = async (customer) => {
        setDebtDlg(null);
        // paid=0 → the whole invoice becomes credit balance for the customer
        await pay("credit", { customer_id: customer.id, customer_name: customer.name, paid: 0 });
    };

    const createDebtorAndCharge = async () => {
        const name = (debtDlg.newName || "").trim();
        if (!name) return toast.error("أدخل اسم الزبون");
        try {
            const { data } = await api.post("/customers", {
                name, phone: (debtDlg.newPhone || "").trim(),
                email: "", address: "", opening_balance: 0,
            });
            await confirmCreditSale(data);
        } catch (e) { toast.error(formatApiError(e)); }
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
                <OfflineBadge shopId={shopId} syncing={syncing} onSyncNow={syncQueue} />
                <button onClick={() => setHeldOpen(true)} data-testid="held-invoices-btn"
                    className="h-11 px-3 rounded-md bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
                    <PauseCircle className="w-4 h-4" /> معلّقة
                    {held.length > 0 && <span className="bg-white text-fuchsia-700 text-xs font-bold rounded-full min-w-5 h-5 px-1.5 grid place-items-center">{held.length}</span>}
                </button>
                <TopBtn icon={RefreshCw} label="تحديث" color="emerald" onClick={refresh} testid="pos-refresh-btn" />
                <div className="text-white text-xs bg-slate-950/40 rounded px-3 py-1.5 border border-slate-700 tabular-nums">
                    <div className="text-slate-400 text-[10px]">{now.toLocaleDateString("en-GB")}</div>
                    <div className="font-bold">{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
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
                    <div className="grid grid-cols-9 gap-1.5 p-2 bg-white border-t border-zinc-200">
                        <ActBtn icon={Save} label="حفظ الفاتورة" color="sky" onClick={() => pay("cash")} testid="pay-cash-btn" />
                        <ActBtn icon={Printer} label="طباعة الفاتورة" color="cyan" onClick={() => lastSale && printReceipt("receipt-print-area")} testid="print-last-btn" />
                        <ActBtn icon={ReceiptText} label="طباعة آخر فاتورة" color="pink" onClick={() => lastSale ? setReceiptOpen(true) : toast.error("لا توجد فاتورة سابقة")} />
                        <ActBtn icon={HandCoins} label="ترحيل دين" color="rose" onClick={() => {
                            if (cart.length === 0) return toast.error("السلة فارغة");
                            setDebtDlg({ open: true, search: "", newName: "", newPhone: "", picked: null });
                        }} testid="credit-sale-btn" />
                        <ActBtn icon={DollarSign} label="تفاصيل الدفع" color="violet" onClick={() => pay("card")} testid="pay-card-btn" />
                        <ActBtn icon={FileText} label="عرض سعر" color="amber" onClick={() => toast.info("قريباً")} />
                        <ActBtn icon={PauseCircle} label="تعليق الفاتورة" color="pink" onClick={holdCart} testid="hold-invoice-btn" />
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
                                        className="pos-card bg-white border-2 border-zinc-200 hover:border-blue-500 hover:shadow-md rounded p-2 text-center transition-all flex flex-col justify-between min-h-[86px]"
                                        style={{ borderTopColor: catColor(p.category_id), borderTopWidth: "4px" }}>
                                        <div className="text-[12px] font-semibold text-slate-900 leading-tight line-clamp-3 flex-1 grid place-items-center px-1">{p.name}</div>
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
                    <div className="space-y-3">
                        <label className="text-sm">رقم الواتساب (مع رمز الدولة)</label>
                        <div className="flex gap-2">
                            <Input value={waPhone} onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, ""))}
                                placeholder="970591234567" data-testid="wa-phone-input"
                                className="tabular-nums text-lg h-12 flex-1 text-left" dir="ltr" />
                            <button type="button" onClick={() => setWaPhone(p => p.slice(0, -1))}
                                data-testid="wa-backspace-btn"
                                className="h-12 px-4 rounded-md bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold flex items-center gap-1.5 shadow-sm transition-colors">
                                <Delete className="w-5 h-5" /> تراجع
                            </button>
                        </div>
                        {/* Touch numpad */}
                        <div className="grid grid-cols-3 gap-1.5" dir="ltr" data-testid="wa-numpad">
                            {[1,2,3,4,5,6,7,8,9].map(n => (
                                <button key={n} type="button" onClick={() => setWaPhone(p => (p || "") + n)}
                                    data-testid={`wa-key-${n}`}
                                    className="h-12 rounded-md bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 text-xl font-bold tabular-nums transition-colors">
                                    {n}
                                </button>
                            ))}
                            <button type="button" onClick={() => setWaPhone("")}
                                data-testid="wa-clear-btn"
                                className="h-12 rounded-md bg-rose-100 hover:bg-rose-200 active:bg-rose-300 text-rose-800 text-xs font-bold transition-colors">
                                مسح
                            </button>
                            <button type="button" onClick={() => setWaPhone(p => (p || "") + "0")}
                                data-testid="wa-key-0"
                                className="h-12 rounded-md bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 text-xl font-bold tabular-nums transition-colors">
                                0
                            </button>
                            <button type="button" onClick={() => setWaPhone(p => p.slice(0, -1))}
                                data-testid="wa-numpad-back"
                                className="h-12 rounded-md bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-800 flex items-center justify-center transition-colors">
                                <Delete className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">مثال: 970591234567 (بدون + أو 00)</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setWaOpen(false)}>إلغاء</Button>
                        <Button onClick={sendWA} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="wa-send-btn"><MessageCircle className="w-4 h-4" /> فتح واتساب</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Credit sale (ترحيل دين) dialog */}
            <Dialog open={!!debtDlg?.open} onOpenChange={(o) => !o && setDebtDlg(null)}>
                <DialogContent dir="rtl" className="bg-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <HandCoins className="w-5 h-5 text-rose-600" /> ترحيل الفاتورة على دين — {fmt(total)} شيكل
                        </DialogTitle>
                    </DialogHeader>
                    {debtDlg && (
                        <div className="space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input value={debtDlg.search} onChange={(e) => setDebtDlg(d => ({ ...d, search: e.target.value }))}
                                    data-testid="debt-search" autoFocus
                                    placeholder="ابحث عن عميل بالاسم أو رقم الهاتف…"
                                    className="pr-10 h-11 bg-white text-sm" />
                            </div>

                            {/* Existing customers list */}
                            <div className="max-h-72 overflow-y-auto border border-zinc-200 rounded-md">
                                {filteredDebtors.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-sm">
                                        <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        لا يوجد عميل بهذا الاسم — أضف عميلاً جديداً من الأسفل
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-100">
                                        {filteredDebtors.map(c => (
                                            <button key={c.id} onClick={() => confirmCreditSale(c)} data-testid={`credit-pick-${c.id}`}
                                                className="w-full flex items-center justify-between p-3 hover:bg-rose-50 transition-colors text-right">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-sm text-slate-900 truncate">{c.name}</div>
                                                    <div className="text-xs text-slate-500 tabular-nums">{c.phone || "بدون رقم"}</div>
                                                </div>
                                                <div className="text-left shrink-0">
                                                    <div className="text-[10px] text-slate-500">الرصيد الحالي</div>
                                                    <div className={`tabular-nums font-bold ${(c.balance || 0) > 0 ? "text-rose-700" : "text-slate-600"}`}>{fmt(c.balance || 0)}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add new customer inline */}
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                                <div className="text-xs font-semibold text-emerald-900 mb-2 flex items-center gap-1.5">
                                    <UserPlus className="w-3.5 h-3.5" /> أو أضف عميلاً جديداً وارحّل الفاتورة عليه
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input value={debtDlg.newName} onChange={(e) => setDebtDlg(d => ({ ...d, newName: e.target.value }))}
                                        placeholder="اسم العميل" data-testid="credit-new-name" className="h-9 text-sm bg-white" />
                                    <Input value={debtDlg.newPhone} onChange={(e) => setDebtDlg(d => ({ ...d, newPhone: e.target.value }))}
                                        placeholder="رقم الواتساب (اختياري)" data-testid="credit-new-phone" className="h-9 text-sm bg-white tabular-nums" />
                                </div>
                                <Button onClick={createDebtorAndCharge} disabled={!debtDlg.newName?.trim()}
                                    data-testid="credit-new-save"
                                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-9">
                                    <UserPlus className="w-4 h-4" /> إضافة ومحاسبة على الدين
                                </Button>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDebtDlg(null)}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Held invoices dialog */}
            <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
                <DialogContent dir="rtl" className="bg-white max-w-3xl">
                    <DialogHeader><DialogTitle>الفواتير المعلّقة</DialogTitle></DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {held.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                <PauseCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                لا توجد فواتير معلّقة
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {held.map(h => {
                                    const t = h.items.reduce((s, i) => s + i.qty * i.price - (i.discount || 0), 0);
                                    return (
                                        <div key={h.id} className="border border-zinc-200 rounded-md p-3 hover:border-blue-500 hover:shadow-sm transition-all" data-testid={`held-row-${h.id}`}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="font-semibold text-sm">{h.label}</div>
                                                    <div className="text-xs text-slate-500">{h.user_name} • {h.created_at?.substring(11, 16)}</div>
                                                </div>
                                                <button onClick={() => deleteHeld(h)} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                            <div className="text-xs text-slate-600 mb-2 max-h-16 overflow-y-auto">
                                                {h.items.slice(0, 5).map((i, k) => (
                                                    <div key={k} className="flex justify-between"><span className="truncate">• {i.name} × {i.qty}</span><span className="tabular-nums shrink-0 ms-2">{fmt(i.qty * i.price)}</span></div>
                                                ))}
                                                {h.items.length > 5 && <div className="text-slate-400">... +{h.items.length - 5} صنف</div>}
                                            </div>
                                            <div className="flex items-center justify-between border-t pt-2">
                                                <span className="text-lg font-bold tabular-nums text-blue-700">{fmt(t)}</span>
                                                <div className="flex gap-1.5">
                                                    <Button size="sm" variant="outline" onClick={() => printHeld(h)} className="gap-1" data-testid={`print-held-${h.id}`}><Printer className="w-3.5 h-3.5" /> طباعة</Button>
                                                    <Button size="sm" onClick={() => resumeHeld(h)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" data-testid={`resume-${h.id}`}><PlayCircle className="w-3.5 h-3.5" /> استئناف</Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Quick-add unknown barcode dialog */}
            <Dialog open={!!quickAdd} onOpenChange={(o) => !o && setQuickAdd(null)}>
                <DialogContent dir="rtl" className="bg-white">
                    <DialogHeader><DialogTitle>باركود غير معروف — إضافة منتج جديد</DialogTitle></DialogHeader>
                    {quickAdd && (
                        <div className="space-y-3">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                <div className="text-xs text-amber-800 mb-1">الباركود المُلتقط</div>
                                <div className="font-mono tabular-nums text-lg font-bold text-amber-900">{quickAdd.barcode}</div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">اسم المنتج *</label>
                                <Input value={quickAdd.name} onChange={(e) => setQuickAdd(q => ({...q, name: e.target.value}))} data-testid="quick-add-name" autoFocus placeholder="مثال: علبة تونا 200غ" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">الفئة</label>
                                {topCategories.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2" data-testid="quick-add-recent-cats">
                                        <span className="text-[10px] text-slate-500 font-medium self-center">الأكثر استخداماً:</span>
                                        {topCategories.map(c => {
                                            const active = quickAdd.category_id === c.id;
                                            return (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setQuickAdd(q => ({ ...q, category_id: c.id }))}
                                                    data-testid={`quick-add-recent-${c.id}`}
                                                    className={`h-7 px-2.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${active ? "text-white shadow-sm" : "bg-white text-slate-800 border-zinc-300 hover:bg-zinc-50"}`}
                                                    style={active ? { backgroundColor: c.color, borderColor: c.color } : {}}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${active ? "bg-white/80" : ""}`} style={!active ? { backgroundColor: c.color } : {}} />
                                                    {c.name}
                                                    <span className={`tabular-nums text-[9px] px-1 rounded ${active ? "bg-white/25" : "bg-zinc-100 text-slate-500"}`}>{catUsage[c.id]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <select value={quickAdd.category_id} onChange={(e) => setQuickAdd(q => ({...q, category_id: e.target.value}))}
                                    data-testid="quick-add-category"
                                    className="w-full h-10 border border-zinc-200 rounded-md px-3 mt-1 bg-white text-sm">
                                    <option value="">— بدون فئة —</option>
                                    {sortedCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}{catUsage[c.id] ? `  •  استُخدم ${catUsage[c.id]}×` : ""}</option>
                                    ))}
                                </select>
                                {quickAdd.category_id && (
                                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                                        <span className="w-3 h-3 rounded" style={{ backgroundColor: categories.find(c => c.id === quickAdd.category_id)?.color || "#3b82f6" }} />
                                        <span className="text-slate-600">{categories.find(c => c.id === quickAdd.category_id)?.name}</span>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-sm font-medium">التكلفة</label>
                                    <Input type="number" value={quickAdd.cost_price} onChange={(e) => setQuickAdd(q => ({...q, cost_price: e.target.value}))} data-testid="quick-add-cost" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">سعر البيع *</label>
                                    <Input type="number" value={quickAdd.sale_price} onChange={(e) => setQuickAdd(q => ({...q, sale_price: e.target.value}))} data-testid="quick-add-price" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">الكمية</label>
                                    <Input type="number" value={quickAdd.stock} onChange={(e) => setQuickAdd(q => ({...q, stock: e.target.value}))} data-testid="quick-add-stock" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">سيُضاف المنتج للمخزن الحالي وسيدخل السلة تلقائياً.</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuickAdd(null)}>إلغاء</Button>
                        <Button onClick={submitQuickAdd} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="quick-add-save"><Save className="w-4 h-4" /> حفظ وإضافة للسلة</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden print area for held invoice slip */}
            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
                <div id="held-print-area">
                    {heldPrintPreview && (
                        <ReceiptPreview shop={user?.shop} kind="pending"
                            sale={{
                                items: heldPrintPreview.items,
                                created_at: heldPrintPreview.created_at,
                                cashier_name: heldPrintPreview.user_name,
                                customer_name: heldPrintPreview.customer_name,
                                label: heldPrintPreview.label,
                                discount: heldPrintPreview.discount,
                            }}
                            cashierName={heldPrintPreview.user_name} />
                    )}
                </div>
            </div>
        </div>
    );
}
