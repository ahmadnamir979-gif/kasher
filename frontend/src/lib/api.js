import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API_URL = `${BACKEND}/api`;

export const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const t = localStorage.getItem("token");
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
});

export function formatApiError(err) {
    const d = err?.response?.data?.detail;
    if (!d) return err?.message || "حدث خطأ ما";
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" • ");
    return String(d);
}

export const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtInt = (n) => Number(n || 0).toLocaleString("ar-EG");
