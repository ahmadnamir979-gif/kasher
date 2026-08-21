import { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiError, isNetworkError } from "@/lib/api";

const AuthContext = createContext(null);
const USER_CACHE_KEY = "cached_user";

function loadCachedUser() {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function saveCachedUser(u) {
    try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u)); } catch {}
}
function clearCachedUser() {
    try { localStorage.removeItem(USER_CACHE_KEY); } catch {}
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = checking
    const [ready, setReady] = useState(false);
    const [offline, setOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const on = () => setOffline(false);
        const off = () => setOffline(true);
        window.addEventListener("online", on);
        window.addEventListener("offline", off);
        return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    }, []);

    useEffect(() => {
        (async () => {
            const token = localStorage.getItem("token");
            const cached = loadCachedUser();
            if (!token) { setUser(false); setReady(true); return; }
            try {
                const { data } = await api.get("/auth/me");
                setUser(data);
                saveCachedUser(data);
            } catch (e) {
                // Offline / network glitch: keep the cached user logged in so POS still opens
                if (isNetworkError(e) && cached) {
                    setUser(cached);
                    setOffline(true);
                } else {
                    setUser(false);
                    clearCachedUser();
                }
            } finally { setReady(true); }
        })();
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post("/auth/login", { email, password });
            if (data.token) localStorage.setItem("token", data.token);
            const me = await api.get("/auth/me");
            setUser(me.data);
            saveCachedUser(me.data);
            return { ok: true, user: me.data };
        } catch (e) {
            return { ok: false, error: formatApiError(e) };
        }
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch {}
        localStorage.removeItem("token");
        clearCachedUser();
        setUser(false);
    };

    return (
        <AuthContext.Provider value={{ user, ready, offline, login, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
