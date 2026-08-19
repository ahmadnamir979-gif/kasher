import { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = checking
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/auth/me");
                setUser(data);
            } catch { setUser(false); }
            finally { setReady(true); }
        })();
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post("/auth/login", { email, password });
            if (data.token) localStorage.setItem("token", data.token);
            const me = await api.get("/auth/me");
            setUser(me.data);
            return { ok: true, user: me.data };
        } catch (e) {
            return { ok: false, error: formatApiError(e) };
        }
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch {}
        localStorage.removeItem("token");
        setUser(false);
    };

    return (
        <AuthContext.Provider value={{ user, ready, login, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
