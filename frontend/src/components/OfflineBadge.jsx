import { useEffect, useState } from "react";
import { Wifi, WifiOff, CloudUpload, Check } from "lucide-react";
import { queue } from "@/lib/offline";

export function OfflineBadge({ shopId, syncing, onSyncNow }) {
    const [online, setOnline] = useState(navigator.onLine);
    const [count, setCount] = useState(() => queue.count(shopId));

    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener("online", on);
        window.addEventListener("offline", off);
        const t = setInterval(() => setCount(queue.count(shopId)), 1500);
        return () => {
            window.removeEventListener("online", on);
            window.removeEventListener("offline", off);
            clearInterval(t);
        };
    }, [shopId]);

    if (online && count === 0 && !syncing) {
        return (
            <div className="h-11 px-3 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2" data-testid="net-badge-online">
                <Wifi className="w-4 h-4" /> متصل
            </div>
        );
    }
    if (!online) {
        return (
            <button onClick={onSyncNow} data-testid="net-badge-offline"
                className="h-11 px-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm">
                <WifiOff className="w-4 h-4" /> بدون إنترنت
                {count > 0 && <span className="bg-white text-rose-700 rounded-full min-w-5 h-5 px-1.5 grid place-items-center text-[11px] font-bold tabular-nums">{count}</span>}
            </button>
        );
    }
    return (
        <button onClick={onSyncNow} data-testid="net-badge-sync"
            className="h-11 px-3 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-2 shadow-sm">
            {syncing ? <CloudUpload className="w-4 h-4 animate-pulse" /> : <Check className="w-4 h-4" />}
            {syncing ? "جارٍ المزامنة…" : `مزامنة (${count})`}
        </button>
    );
}
