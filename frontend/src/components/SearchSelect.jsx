import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X } from "lucide-react";

/**
 * SearchSelect — Searchable combobox replacement for <select>.
 * Props:
 *  - value: current selected id/value
 *  - onChange: (newValue) => void
 *  - options: array of { value, label, hint?, ... }
 *  - placeholder: default label when nothing selected
 *  - searchKeys: extra object keys on options to search within (default ["label", "hint"])
 *  - allowEmpty: show "— بدون —" option
 *  - emptyLabel: label for the empty option
 *  - disabled: boolean
 *  - testid: data-testid for root button
 */
export default function SearchSelect({
    value,
    onChange,
    options = [],
    placeholder = "اختر…",
    searchKeys = ["label", "hint"],
    allowEmpty = false,
    emptyLabel = "— بدون —",
    disabled = false,
    testid,
    className = "",
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const [hi, setHi] = useState(0);

    const selected = useMemo(
        () => options.find(o => String(o.value) === String(value)),
        [options, value]
    );

    const filtered = useMemo(() => {
        if (!q.trim()) return options;
        const t = q.trim().toLowerCase();
        return options.filter(o =>
            searchKeys.some(k => (o[k] || "").toString().toLowerCase().includes(t))
        );
    }, [options, q, searchKeys]);

    useEffect(() => {
        if (!open) return;
        setHi(0);
        setTimeout(() => inputRef.current?.focus(), 10);
        const close = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
                setQ("");
            }
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    const pick = (val) => {
        onChange?.(val);
        setOpen(false);
        setQ("");
    };

    const onKey = (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min((filtered.length + (allowEmpty ? 1 : 0)) - 1, h + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
        else if (e.key === "Enter") {
            e.preventDefault();
            const list = allowEmpty ? [{ value: "", label: emptyLabel }, ...filtered] : filtered;
            const target = list[hi];
            if (target) pick(target.value);
        } else if (e.key === "Escape") { setOpen(false); setQ(""); }
    };

    const list = allowEmpty ? [{ value: "", label: emptyLabel, __empty: true }, ...filtered] : filtered;

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                data-testid={testid}
                className={`w-full h-10 px-3 border border-zinc-200 rounded-md bg-white text-right flex items-center justify-between gap-2 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                <span className={`flex-1 truncate text-sm ${selected ? "text-slate-900" : "text-slate-400"}`}>
                    {selected ? selected.label : placeholder}
                </span>
                {selected && !disabled && allowEmpty && (
                    <X onClick={(e) => { e.stopPropagation(); pick(""); }}
                        className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500 shrink-0" />
                )}
            </button>
            {open && (
                <div className="absolute z-50 top-full mt-1 right-0 left-0 bg-white border border-zinc-200 rounded-md shadow-xl overflow-hidden" data-testid={testid ? `${testid}-panel` : undefined}>
                    <div className="p-2 border-b border-zinc-100 bg-zinc-50">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={q}
                                onChange={(e) => { setQ(e.target.value); setHi(0); }}
                                onKeyDown={onKey}
                                placeholder="ابحث…"
                                className="w-full h-9 pr-8 pl-3 bg-white border border-zinc-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                                data-testid={testid ? `${testid}-input` : undefined}
                            />
                        </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {list.length === 0 && (
                            <div className="p-4 text-center text-sm text-slate-400">لا توجد نتائج</div>
                        )}
                        {list.map((o, i) => {
                            const isSel = String(o.value) === String(value);
                            const isHi = i === hi;
                            return (
                                <button
                                    key={`${o.value}-${i}`}
                                    type="button"
                                    onMouseEnter={() => setHi(i)}
                                    onClick={() => pick(o.value)}
                                    className={`w-full text-right px-3 py-2 text-sm border-b border-zinc-50 last:border-0 flex items-center justify-between gap-2 transition
                                        ${isSel ? "bg-amber-50 font-semibold text-amber-900" : ""}
                                        ${isHi ? "bg-amber-100" : "hover:bg-zinc-50"}
                                        ${o.__empty ? "text-slate-400 italic" : ""}`}
                                >
                                    <span className="truncate flex-1">{o.label}</span>
                                    {o.hint && <span className="text-xs text-slate-500 shrink-0">{o.hint}</span>}
                                </button>
                            );
                        })}
                    </div>
                    {q && filtered.length > 0 && (
                        <div className="px-3 py-1.5 bg-zinc-50 border-t text-xs text-slate-500">
                            {filtered.length} نتيجة
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
