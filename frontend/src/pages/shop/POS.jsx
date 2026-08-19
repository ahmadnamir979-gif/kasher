import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError, fmt } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Trash2, Plus, Minus, Printer, Home, X, Store, LogOut, LayoutDashboard } from "lucide-react";

export default function POS() {
    const { user, logout } = useAuth();
    const nav = useNavigate();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCat, setActiveCat] = useState("all");
    const [q, setQ] = useState("");
    const [cart, setCart] = useState([]);
    const [discount, setDiscount] = useState(0);
    const searchRef = useRef(null);

    useEffect(() => {
        api.get("/products").then(r => setProducts(r.data));
        api.get("/categories").then(r => setCategories(r.data));
    }, []);

    useEffect(() => {
        const h = (e) => {
            if (e.key === "F1") { e.preventDefault(); pay("cash"); }
            if (e.ctrlKey && e.key.toLowerCase() === "f") { e.preventDefault(); searchRef.current?.focus(); }
            if (e.key === "Escape") { setCart([]); }
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    });

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        return products.filter(p => (activeCat === "all" || p.category_id === activeCat) &&
            (!t || p.name.toLowerCase().includes(t) || (p.barcode || "").includes(t)));
    }, [products, q, activeCat]);

    const addToCart = (p) => {
        setCart(c => {
            const idx = c.findIndex(x => x.product_id === p.id);
            if (idx >= 0) { const copy = [...c]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy; }
            return [...c, { product_id: p.id, name: p.name, price: p.sale_price, cost: p.cost_price, qty: 1, discount: 0, tax_rate: p.tax_rate || 0 }];
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
        try {
            await api.post("/sales", {
                items: cart, discount, paid: total, payment_method: method,
                customer_name: "زبون نقدي", is_return: false,
            });
            toast.success(`تم البيع بمبلغ ${fmt(total)}`);
            setCart([]); setDiscount(0);
            const { data } = await api.get("/products"); setProducts(data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const catColor = (id) => categories.find(c => c.id === id)?.color || "#3b82f6";

    return (
        <div className="h-screen flex flex-col bg-zinc-100" dir="rtl">
            {/* Top bar */}
            <div className="h-14 bg-slate-900 text-white flex items-center px-4 gap-3 shrink-0">
                <div className="flex items-center gap-2"><Store className="w-5 h-5 text-blue-400" /><span className="font-semibold">{user?.shop?.name || "نقطة البيع"}</span></div>
                <div className="text-xs text-slate-400">/ {user?.name}</div>
                <div className="flex-1" />
                <div className="text-xs text-slate-300 tabular-nums">{new Date().toLocaleString("ar-EG")}</div>
                <Button size="sm" variant="ghost" onClick={() => nav("/dashboard")} className="text-white hover:bg-white/10 gap-2"><LayoutDashboard className="w-4 h-4" /> اللوحة</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await logout(); nav("/login"); }} data-testid="pos-logout-btn" className="text-white hover:bg-white/10 gap-2"><LogOut className="w-4 h-4" /> خروج</Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Cart on left (RTL: left visually) */}
                <div className="w-[380px] shrink-0 bg-white border-l border-zinc-200 flex flex-col">
                    <div className="p-4 border-b border-zinc-200">
                        <div className="text-xs text-slate-500 mb-1">الفاتورة الحالية</div>
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-900">زبون نقدي</div>
                            {cart.length > 0 && <Button size="sm" variant="ghost" onClick={() => setCart([])} className="text-rose-600 h-7"><X className="w-3.5 h-3.5 ml-1" /> إفراغ</Button>}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {cart.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">لا يوجد أصناف • ابحث أو اضغط منتج للإضافة</div>}
                        {cart.map((it, i) => (
                            <div key={i} className="p-3 border-b border-zinc-100 flex items-center gap-2" data-testid={`cart-item-${i}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 truncate">{it.name}</div>
                                    <div className="text-xs text-slate-500 tabular-nums">{fmt(it.price)} × {it.qty} = <b className="text-slate-800">{fmt(it.qty*it.price)}</b></div>
                                </div>
                                <div className="flex items-center gap-1 bg-zinc-50 rounded-md p-0.5">
                                    <button onClick={() => setQty(i, it.qty - 1)} className="w-6 h-6 grid place-items-center hover:bg-white rounded"><Minus className="w-3 h-3" /></button>
                                    <input type="number" value={it.qty} onChange={(e) => setQty(i, +e.target.value || 1)} className="w-10 text-center text-sm bg-transparent outline-none tabular-nums" />
                                    <button onClick={() => setQty(i, it.qty + 1)} className="w-6 h-6 grid place-items-center hover:bg-white rounded"><Plus className="w-3 h-3" /></button>
                                </div>
                                <button onClick={() => removeItem(i)} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-zinc-200 p-4 space-y-2 bg-zinc-50">
                        <div className="flex justify-between text-sm"><span className="text-slate-600">المجموع</span><span className="tabular-nums font-medium">{fmt(subtotal)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-600">الضريبة</span><span className="tabular-nums">{fmt(tax)}</span></div>
                        <div className="flex justify-between text-sm items-center"><span className="text-slate-600">خصم</span>
                            <Input type="number" value={discount} onChange={(e) => setDiscount(+e.target.value || 0)} className="w-24 h-7 text-right tabular-nums" data-testid="discount-input" /></div>
                        <div className="flex justify-between pt-2 border-t border-zinc-200"><span className="font-semibold text-slate-900">الإجمالي</span><span className="text-2xl font-bold tabular-nums text-slate-900">{fmt(total)}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-white border-t border-zinc-200">
                        <Button onClick={() => pay("card")} className="h-14 bg-blue-600 hover:bg-blue-700 text-white flex-col gap-0.5" data-testid="pay-card-btn">
                            <span className="font-semibold">دفع بطاقة</span><kbd className="bg-white/20">F2</kbd>
                        </Button>
                        <Button onClick={() => pay("cash")} className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white flex-col gap-0.5" data-testid="pay-cash-btn">
                            <span className="font-semibold">دفع نقدي</span><kbd className="bg-white/20">F1</kbd>
                        </Button>
                    </div>
                </div>

                {/* Product grid */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 bg-white border-b border-zinc-200">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={handleBarcodeEnter}
                                placeholder="ابحث بالاسم أو الباركود…"
                                data-testid="pos-search-input" className="pr-10 h-11 bg-zinc-50 border-zinc-200" autoFocus />
                            <kbd className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 bg-white border">Ctrl+F</kbd>
                        </div>
                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                            <button onClick={() => setActiveCat("all")} className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${activeCat === "all" ? "bg-slate-900 text-white" : "bg-zinc-100 text-slate-700 hover:bg-zinc-200"}`}>الكل ({products.length})</button>
                            {categories.map(c => (
                                <button key={c.id} onClick={() => setActiveCat(c.id)}
                                    className={`px-4 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${activeCat === c.id ? "text-white" : "bg-zinc-100 text-slate-700 hover:bg-zinc-200"}`}
                                    style={activeCat === c.id ? { backgroundColor: c.color } : {}}>{c.name}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {filtered.length === 0 ? (
                            <div className="text-center text-slate-400 pt-20">
                                <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
                                <p>لا توجد منتجات. أضف منتجات من قسم "المنتجات والمخزون"</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {filtered.map(p => (
                                    <button key={p.id} onClick={() => addToCart(p)} data-testid={`pos-product-${p.id}`}
                                        className="pos-card bg-white border border-zinc-200 rounded-md p-3 text-right hover:border-slate-900">
                                        <div className="aspect-square rounded mb-2 grid place-items-center text-2xl font-bold text-white" style={{ backgroundColor: catColor(p.category_id) }}>{p.name.charAt(0)}</div>
                                        <div className="text-sm font-medium text-slate-900 truncate">{p.name}</div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs text-slate-500 tabular-nums">رصيد: {p.stock}</span>
                                            <span className="text-sm font-bold text-blue-600 tabular-nums">{fmt(p.sale_price)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Package(props) { return <svg {...props} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8l-9-5-9 5 9 5 9-5zm0 8l-9 5-9-5m18-4l-9 5-9-5"/></svg>; }
