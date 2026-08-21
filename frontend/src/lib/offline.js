// Offline-first storage & sync queue for POS
// Uses localStorage keyed per shop; small footprint (<few MB) works well for products/queue.

const nsKey = (base, shopId) => `pos_${base}_${shopId || "x"}`;

// ---------- Snapshot cache (products/categories/warehouses/held) ----------
export const cache = {
    save(shopId, kind, data) {
        try {
            localStorage.setItem(nsKey(kind, shopId), JSON.stringify({ at: Date.now(), data }));
        } catch {}
    },
    load(shopId, kind) {
        try {
            const raw = localStorage.getItem(nsKey(kind, shopId));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    },
    clear(shopId, kind) {
        try { localStorage.removeItem(nsKey(kind, shopId)); } catch {}
    },
};

// ---------- Offline sales queue ----------
const QKEY = (shopId) => nsKey("sale_queue", shopId);

export const queue = {
    all(shopId) {
        try { return JSON.parse(localStorage.getItem(QKEY(shopId)) || "[]"); } catch { return []; }
    },
    _write(shopId, list) {
        try { localStorage.setItem(QKEY(shopId), JSON.stringify(list)); } catch {}
    },
    add(shopId, payload) {
        const list = queue.all(shopId);
        const item = {
            id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            payload,
            created_at: new Date().toISOString(),
            attempts: 0,
            last_error: null,
        };
        list.push(item);
        queue._write(shopId, list);
        return item;
    },
    remove(shopId, id) {
        queue._write(shopId, queue.all(shopId).filter(x => x.id !== id));
    },
    updateError(shopId, id, err) {
        const list = queue.all(shopId).map(x => x.id === id ? { ...x, attempts: x.attempts + 1, last_error: err } : x);
        queue._write(shopId, list);
    },
    count(shopId) { return queue.all(shopId).length; },
};

// ---------- Online detection ----------
export function isNetworkError(err) {
    if (!err) return false;
    if (err.code === "ERR_NETWORK") return true;
    if (err.message === "Network Error") return true;
    if (err.response === undefined && err.request) return true;
    return false;
}
