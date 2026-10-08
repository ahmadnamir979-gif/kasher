import { useEffect, useState } from "react";
import { Store, ShoppingCart, Gift } from "lucide-react";

/**
 * Customer Display — Opens in a secondary window on a 2nd monitor.
 * Shows the live cart, promotions, and total as scanning happens on the POS.
 */
export default function CustomerDisplay() {
    const [state, setState] = useState({ cart: [], subtotal: 0, tax: 0, discount: 0, promo_discount: 0, applied: [], total: 0, shop: "" });
    const [now, setNow] = useState(new Date());
    const [flash, setFlash] = useState(false);
    const [lastCount, setLastCount] = useState(0);
    const fmt = (n) => Number(n || 0).toFixed(2);

    // Preload beep sound
    const playBeep = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 1200;
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.15);
        } catch {}
    };

    useEffect(() => {
        let bc;
        try {
            bc = new BroadcastChannel("al-arraab-pos");
            bc.onmessage = (e) => { if (e.data?.type === "cart") setState(prev => ({ ...prev, ...e.data })); };
        } catch {}
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => { try { bc?.close(); } catch {} clearInterval(t); };
    }, []);

    // When cart grows, flash + beep
    useEffect(() => {
        const totalQty = state.cart.reduce((s, i) => s + (i.qty || 0), 0);
        if (totalQty > lastCount && lastCount >= 0) {
            setFlash(true);
            playBeep();
            const t = setTimeout(() => setFlash(false), 450);
            return () => clearTimeout(t);
        }
        setLastCount(totalQty);
    }, [state.cart]); // eslint-disable-line

    const lastItem = state.cart[state.cart.length - 1];

    return (
        <div dir="rtl" className={`min-h-screen bg-gradient-to-br from-[#0f2340] via-[#1e3a5f] to-[#243f66] text-white flex flex-col font-sans transition-all duration-200 ${flash ? "ring-[12px] ring-amber-300 ring-inset bg-amber-400/20" : ""}`}>
            {/* Top bar */}
            <div className="h-16 bg-black/30 backdrop-blur-md flex items-center justify-between px-8 border-b-2 border-amber-500/40">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 grid place-items-center shadow-lg">
                        <Store className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="text-xl font-bold">{state.shop || "العرّاب"}</div>
                        <div className="text-xs text-amber-200/80">أهلاً وسهلاً — نتمنى لكم تسوقاً ممتعاً</div>
                    </div>
                </div>
                <div className="tabular-nums text-amber-300 font-mono text-lg">{now.toLocaleString("en-GB")}</div>
            </div>

            {/* Last scanned item hero */}
            {lastItem ? (
                <div className="px-8 pt-6">
                    <div className="bg-amber-500/15 border border-amber-400/40 rounded-2xl p-6 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300" data-testid="last-item">
                        <div>
                            <div className="text-amber-300 text-xs font-semibold mb-1">آخر صنف مُضاف</div>
                            <div className="text-4xl font-black">{lastItem.name}</div>
                            <div className="text-amber-200/80 text-sm mt-1">الكمية: <span className="tabular-nums font-bold">{lastItem.qty}</span></div>
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-amber-300 mb-1">السعر</div>
                            <div className="text-5xl font-black text-amber-300 tabular-nums">{fmt(lastItem.price * lastItem.qty)}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 grid place-items-center">
                    <div className="text-center">
                        <ShoppingCart className="w-24 h-24 mx-auto text-amber-300/50 mb-4" />
                        <div className="text-3xl font-bold text-amber-200/80">بانتظار بدء التسوّق…</div>
                        <div className="text-sm text-amber-200/50 mt-2">هذه شاشة العرض للزبون</div>
                    </div>
                </div>
            )}

            {/* Cart items list */}
            {state.cart.length > 0 && (
                <div className="flex-1 overflow-hidden flex flex-col px-8 pt-4">
                    <div className="text-sm text-amber-300 mb-2 font-semibold">عربة التسوّق — {state.cart.length} صنف</div>
                    <div className="flex-1 overflow-y-auto space-y-1.5 pb-4">
                        {state.cart.slice().reverse().map((it, i) => (
                            <div key={`${it.product_id}-${i}`} className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded px-4 py-2.5 text-sm">
                                <div className="flex-1">
                                    <div className="font-semibold">{it.name}</div>
                                    <div className="text-xs text-amber-200/60 tabular-nums">{it.qty} × {fmt(it.price)}</div>
                                </div>
                                <div className="tabular-nums font-bold text-lg text-amber-200">{fmt(it.qty * it.price)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Promotions banner */}
            {state.applied?.length > 0 && (
                <div className="px-8">
                    <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl px-5 py-3 flex items-center justify-between" data-testid="disp-promos">
                        <div className="flex items-center gap-2 text-emerald-200">
                            <Gift className="w-5 h-5" />
                            <span className="font-bold">🎉 عروض نشطة:</span>
                            <span>{state.applied.map(a => a.name).join(" · ")}</span>
                        </div>
                        <div className="tabular-nums font-black text-2xl text-emerald-300">-{fmt(state.promo_discount)}</div>
                    </div>
                </div>
            )}

            {/* Totals strip */}
            <div className="bg-black/40 backdrop-blur-md border-t-2 border-amber-500/60 px-8 py-5">
                <div className="grid grid-cols-4 gap-6 items-center">
                    <Stat label="المجموع الفرعي" value={fmt(state.subtotal)} />
                    <Stat label="الضريبة" value={fmt(state.tax)} />
                    <Stat label="الخصم" value={`-${fmt((state.discount || 0) + (state.promo_discount || 0))}`} color="text-rose-300" />
                    <div className="text-left">
                        <div className="text-xs text-amber-300 mb-1">الإجمالي المطلوب</div>
                        <div className="text-6xl font-black tabular-nums text-amber-300 drop-shadow-lg" data-testid="disp-total">{fmt(state.total)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, color = "text-white" }) {
    return (
        <div>
            <div className="text-xs text-amber-200/70">{label}</div>
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
        </div>
    );
}
