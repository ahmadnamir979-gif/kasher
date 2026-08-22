import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

export function ReminderBell() {
    const [count, setCount] = useState(0);

    const load = async () => {
        try {
            const { data } = await api.get("/debt-reminders/due-count");
            setCount(data.count || 0);
        } catch {}
    };
    useEffect(() => {
        load();
        const t = setInterval(load, 60000); // refresh every minute
        return () => clearInterval(t);
    }, []);

    return (
        <Link to="/reminders" data-testid="reminder-bell"
            className={`relative flex items-center justify-center h-10 w-10 rounded-md border transition-colors ${count > 0 ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 animate-pulse" : "bg-white border-zinc-200 text-slate-600 hover:bg-zinc-50"}`}>
            <Bell className="w-4 h-4" />
            {count > 0 && (
                <span className="absolute -top-1.5 -left-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 grid place-items-center tabular-nums shadow" data-testid="reminder-bell-count">
                    {count > 99 ? "99+" : count}
                </span>
            )}
        </Link>
    );
}
