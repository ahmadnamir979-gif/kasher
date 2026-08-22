import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Printer, CheckCircle2, ExternalLink, Package, Info, Monitor, RefreshCw, Download, Upload, Database, ShieldCheck, AlertTriangle } from "lucide-react";
import { printReceipt } from "@/components/Receipt";
import { isDesktop, desktopAPI, silentPrintHTML } from "@/lib/desktop";
import { api, formatApiError, API_URL } from "@/lib/api";

const PREF_KEYS = {
    autoPrint: "pos_auto_print",
    printerName: "pos_printer_name",
    paperSize: "pos_paper_size",
    copies: "pos_print_copies",
};
const loadPref = (k, d = "") => localStorage.getItem(k) ?? d;

export default function Settings() {
    const { user } = useAuth();
    const [autoPrint, setAutoPrint] = useState(loadPref(PREF_KEYS.autoPrint) === "1");
    const [printerName, setPrinterName] = useState(loadPref(PREF_KEYS.printerName));
    const [paperSize, setPaperSize] = useState(loadPref(PREF_KEYS.paperSize, "80mm"));
    const [copies, setCopies] = useState(+loadPref(PREF_KEYS.copies, "1"));
    const [printers, setPrinters] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [autoLaunch, setAutoLaunch] = useState(true);
    // Backup state
    const [backupSummary, setBackupSummary] = useState(null);
    const [restoreFile, setRestoreFile] = useState(null);
    const [restoreMode, setRestoreMode] = useState("merge");
    const [restoring, setRestoring] = useState(false);
    const [restoreResult, setRestoreResult] = useState(null);
    const [downloading, setDownloading] = useState(false);

    // Load OS-level printers if running in Electron desktop app
    const loadPrinters = async () => {
        if (!isDesktop) return;
        setRefreshing(true);
        try {
            const list = await desktopAPI.listPrinters();
            setPrinters(list || []);
            const s = await desktopAPI.getSettings();
            setAutoLaunch(!!s.autoLaunch);
            if (!printerName && list?.length) {
                const dflt = list.find(p => p.isDefault) || list[0];
                setPrinterName(dflt.name);
            }
        } catch (e) { console.warn(e); }
        setRefreshing(false);
    };
    useEffect(() => { loadPrinters(); /* eslint-disable-next-line */ }, []);

    // Load backup summary
    const loadBackupSummary = async () => {
        try { const { data } = await api.get("/backup/summary"); setBackupSummary(data); }
        catch (e) { /* silent */ }
    };
    useEffect(() => { loadBackupSummary(); }, []);

    const downloadBackup = async () => {
        setDownloading(true);
        try {
            const res = await api.get("/backup/export", { responseType: "blob" });
            const url = window.URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            const shopSlug = (user?.shop?.name || "shop").replace(/\s+/g, "_");
            const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
            a.download = `backup-${shopSlug}-${stamp}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("تمّ تحميل النسخة الاحتياطية بنجاح ✓");
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setDownloading(false); }
    };

    const doRestore = async () => {
        if (!restoreFile) return toast.error("اختر ملف النسخة الاحتياطية أولاً");
        if (restoreMode === "replace" && !window.confirm(
            "⚠️ وضع الاستعادة الكامل سيحذف كل بيانات المحل الحالية ويستبدلها بمحتوى الملف. متأكد؟"
        )) return;
        setRestoring(true); setRestoreResult(null);
        try {
            const form = new FormData();
            form.append("file", restoreFile);
            const { data } = await api.post(`/backup/restore?mode=${restoreMode}`, form, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setRestoreResult(data);
            toast.success("تمّت الاستعادة بنجاح — أُعيد تحميل بيانات المحل");
            setRestoreFile(null);
            loadBackupSummary();
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setRestoring(false); }
    };

    // Persist all prefs to localStorage AND to electron-store (desktop)
    useEffect(() => {
        localStorage.setItem(PREF_KEYS.autoPrint, autoPrint ? "1" : "0");
        localStorage.setItem(PREF_KEYS.printerName, printerName || "");
        localStorage.setItem(PREF_KEYS.paperSize, paperSize);
        localStorage.setItem(PREF_KEYS.copies, String(copies || 1));
        if (isDesktop) desktopAPI.setSettings({ autoPrint, printerName, paperSize, copies });
    }, [autoPrint, printerName, paperSize, copies]);

    useEffect(() => {
        if (isDesktop) desktopAPI.setSettings({ autoLaunch });
    }, [autoLaunch]);

    const printTest = async () => {
        const html = `
            <div style="width:${paperSize === "a4" ? "210mm" : paperSize}; padding:6mm 4mm; font-family:'IBM Plex Sans Arabic', monospace; direction:rtl; color:#000">
                <div style="text-align:center; font-weight:700; font-size:16px;">${user?.shop?.name || "المحل"}</div>
                <div style="text-align:center; font-size:11px; margin-bottom:8px;">تجربة طباعة</div>
                <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; font-size:12px;">
                    <div style="display:flex; justify-content:space-between"><span>الطابعة</span><span>${printerName || "الافتراضية"}</span></div>
                    <div style="display:flex; justify-content:space-between"><span>مقاس الورق</span><span>${paperSize}</span></div>
                    <div style="display:flex; justify-content:space-between"><span>عدد النسخ</span><span>${copies}</span></div>
                    <div style="display:flex; justify-content:space-between"><span>الوضع</span><span>${isDesktop ? "برنامج سطح مكتب" : "متصفح ويب"}</span></div>
                    <div style="display:flex; justify-content:space-between"><span>التاريخ</span><span>${new Date().toLocaleString("en-GB")}</span></div>
                </div>
                <div style="text-align:center; margin-top:10px; font-size:13px; font-weight:700;">✓ الطباعة تعمل بنجاح</div>
            </div>`;
        try {
            const res = await silentPrintHTML({ html, deviceName: printerName, copies, paperSize });
            toast.success(res.ok ? (isDesktop ? "تمّت الطباعة الصامتة على " + (printerName || "الافتراضية") : "جاري إرسال الإيصال للطابعة") : "فشلت الطباعة");
        } catch (e) { toast.error("خطأ في الطباعة"); }
    };

    return (
        <div dir="rtl" className="space-y-6 max-w-4xl" data-testid="settings-page">
            {/* Desktop mode indicator */}
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${isDesktop ? "bg-emerald-50 border-emerald-300" : "bg-sky-50 border-sky-300"}`}>
                <Monitor className={`w-8 h-8 ${isDesktop ? "text-emerald-600" : "text-sky-600"}`} />
                <div className="flex-1">
                    <div className="font-bold text-slate-900">{isDesktop ? "برنامج سطح المكتب — العرّاب Desktop" : "وضع المتصفح"}</div>
                    <p className="text-xs text-slate-600 mt-0.5">
                        {isDesktop
                            ? `مثبّت كبرنامج على الجهاز • ${desktopAPI?.platform} • Electron ${desktopAPI?.version} • طباعة صامتة مباشرة للطابعة ✓`
                            : "أنت تستخدم النسخة الويب في المتصفح. حمّل نسخة البرنامج المثبّت من الأسفل للحصول على الطباعة الصامتة."}
                    </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${isDesktop ? "bg-emerald-600 text-white" : "bg-sky-600 text-white"}`}>
                    {isDesktop ? "Desktop" : "Web"}
                </span>
            </div>

            {/* Backup & Restore */}
            <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 bg-gradient-to-l from-emerald-50 to-white">
                    <Database className="w-5 h-5 text-emerald-600" />
                    <h2 className="font-semibold text-slate-900">النسخ الاحتياطي — بيانات محلي فقط</h2>
                    <div className="flex-1" />
                    <div className="text-xs text-slate-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> بيانات محلك معزولة عن أي محل آخر</div>
                </header>
                <div className="p-5 space-y-5">
                    {/* Summary */}
                    {backupSummary && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                { k: "products", label: "منتجات" },
                                { k: "sales", label: "فواتير" },
                                { k: "customers", label: "عملاء" },
                                { k: "suppliers", label: "موردين" },
                                { k: "categories", label: "أصناف" },
                                { k: "warehouses", label: "مخازن" },
                                { k: "shifts", label: "ورديات" },
                                { k: "expenses", label: "مصاريف" },
                            ].map(o => (
                                <div key={o.k} className="p-3 rounded-md bg-zinc-50 border border-zinc-200">
                                    <div className="text-[11px] text-slate-500 mb-0.5">{o.label}</div>
                                    <div className="tabular-nums text-lg font-bold text-slate-900">{backupSummary.totals?.[o.k] ?? 0}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Download */}
                    <div className="p-4 rounded-md border-2 border-emerald-200 bg-emerald-50/50">
                        <div className="flex items-start gap-3">
                            <Download className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <div className="font-bold text-slate-900 mb-1">تحميل نسخة احتياطية كاملة</div>
                                <p className="text-xs text-slate-600 leading-relaxed">يتم تصدير كل بيانات محلك (منتجات، فواتير، عملاء، ديون، أصناف، مخازن، ورديات، مصاريف...) في ملف ZIP واحد يمتلكه محلك فقط. احتفظ به على جهازك أو على فلاش/سحابة لأي طارئ.</p>
                                <Button onClick={downloadBackup} disabled={downloading} data-testid="backup-download-btn"
                                    className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                    <Download className="w-4 h-4" /> {downloading ? "جارٍ التصدير…" : "حمّل النسخة الاحتياطية الآن"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Restore */}
                    <div className="p-4 rounded-md border-2 border-amber-200 bg-amber-50/40">
                        <div className="flex items-start gap-3">
                            <Upload className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <div className="font-bold text-slate-900 mb-1">استعادة نسخة احتياطية</div>
                                <p className="text-xs text-slate-600 leading-relaxed">ارفع ملف <span className="font-mono bg-white px-1.5 rounded">backup-*.zip</span> الذي حمّلته سابقاً. سيتم استيراد بياناته إلى محلك فقط.</p>
                                <div className="mt-3 space-y-2">
                                    {/* File picker */}
                                    <input type="file" accept=".zip" onChange={(e) => { setRestoreFile(e.target.files?.[0] || null); setRestoreResult(null); }}
                                        data-testid="backup-file-input"
                                        className="block w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer" />
                                    {restoreFile && (
                                        <div className="text-xs text-slate-700 bg-white border border-zinc-200 rounded-md px-3 py-2 flex items-center gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="font-mono">{restoreFile.name}</span>
                                            <span className="text-slate-500">— {(restoreFile.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    )}
                                    {/* Mode */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setRestoreMode("merge")} data-testid="restore-mode-merge"
                                            className={`p-3 rounded-md border text-right transition-all ${restoreMode === "merge" ? "bg-sky-600 text-white border-sky-700 shadow" : "bg-white border-zinc-200 hover:border-sky-400"}`}>
                                            <div className="font-bold text-sm mb-0.5">دمج (Merge) — الأكثر أماناً</div>
                                            <div className={`text-[11px] ${restoreMode === "merge" ? "text-white/80" : "text-slate-500"}`}>يحدّث الموجود ويضيف الجديد. لا يحذف شيئاً.</div>
                                        </button>
                                        <button onClick={() => setRestoreMode("replace")} data-testid="restore-mode-replace"
                                            className={`p-3 rounded-md border text-right transition-all ${restoreMode === "replace" ? "bg-rose-600 text-white border-rose-700 shadow" : "bg-white border-zinc-200 hover:border-rose-400"}`}>
                                            <div className="font-bold text-sm mb-0.5 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> استبدال كامل (Replace)</div>
                                            <div className={`text-[11px] ${restoreMode === "replace" ? "text-white/80" : "text-slate-500"}`}>يحذف كل البيانات الحالية ثم يستورد. لا يمكن التراجع.</div>
                                        </button>
                                    </div>
                                    <Button onClick={doRestore} disabled={!restoreFile || restoring} data-testid="backup-restore-btn"
                                        className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
                                        <Upload className="w-4 h-4" /> {restoring ? "جارٍ الاستعادة…" : "ابدأ الاستعادة"}
                                    </Button>
                                    {restoreResult && (
                                        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-300 text-xs">
                                            <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> نتائج الاستعادة</div>
                                            <div className="text-emerald-800">من محل: <b>{restoreResult.source_shop_name || "—"}</b> — تاريخ التصدير: {restoreResult.source_exported_at?.substring(0, 10)}</div>
                                            <div className="grid grid-cols-3 gap-1.5 mt-2">
                                                {Object.entries(restoreResult.restored || {}).map(([k, v]) => (
                                                    <div key={k} className="bg-white rounded px-2 py-1 border border-emerald-200"><span className="text-slate-500">{k}:</span> <b className="tabular-nums">{v}</b></div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed border-t pt-3">
                        💡 <b>نصيحة:</b> احفظ نسخة احتياطية أسبوعياً على الأقل. الملف يمتلكه محلك فقط ولا يحتوي بيانات محلات أخرى. لا يمكن استخدامه لسرقة بيانات محل ثانٍ — عند الاستعادة يُثبَّت `shop_id` تلقائياً على محلك الحالي.
                    </p>
                </div>
            </section>

            {/* Printer Settings */}
            <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 bg-gradient-to-l from-sky-50 to-white">
                    <Printer className="w-5 h-5 text-sky-600" />
                    <h2 className="font-semibold text-slate-900">إعدادات الطابعة</h2>
                    {isDesktop && (
                        <button onClick={loadPrinters} disabled={refreshing} data-testid="refresh-printers"
                            className="mr-auto text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1">
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> تحديث القائمة
                        </button>
                    )}
                </header>
                <div className="p-5 space-y-5">
                    {/* Auto print toggle */}
                    <div className="flex items-center justify-between p-4 rounded-md border border-zinc-200 bg-zinc-50">
                        <div>
                            <div className="font-semibold text-slate-900">طباعة تلقائية عند حفظ الفاتورة</div>
                            <p className="text-xs text-slate-500 mt-1">ترسل الإيصال مباشرة للطابعة فور حفظ كل فاتورة دون أي ضغطة إضافية</p>
                        </div>
                        <button onClick={() => setAutoPrint(v => !v)} data-testid="setting-auto-print"
                            className={`relative h-8 w-16 rounded-full transition-colors ${autoPrint ? "bg-emerald-500" : "bg-zinc-300"}`}>
                            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${autoPrint ? "right-1" : "right-9"}`} />
                        </button>
                    </div>

                    {/* Printer selection */}
                    <div>
                        <label className="text-sm font-semibold text-slate-800 mb-1.5 block">
                            {isDesktop ? "اختر الطابعة" : "اسم الطابعة الافتراضية"}
                        </label>
                        {isDesktop && printers.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {printers.map(p => {
                                    const active = printerName === p.name;
                                    return (
                                        <button key={p.name} onClick={() => setPrinterName(p.name)}
                                            data-testid={`printer-${p.name}`}
                                            className={`text-right p-3 rounded-md border transition-all ${active ? "bg-emerald-500 text-white border-emerald-600 shadow" : "bg-white border-zinc-200 hover:border-emerald-400"}`}>
                                            <div className="font-semibold text-sm flex items-center gap-1.5">
                                                {active && <CheckCircle2 className="w-4 h-4" />}
                                                {p.displayName || p.name}
                                            </div>
                                            <div className={`text-[11px] mt-0.5 ${active ? "text-white/80" : "text-slate-500"}`}>
                                                {p.isDefault && "افتراضية النظام • "}
                                                {p.status === 0 ? "جاهزة" : `الحالة: ${p.status}`}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <>
                                <Input value={printerName} onChange={(e) => setPrinterName(e.target.value)}
                                    data-testid="setting-printer-name"
                                    placeholder="مثال: XPrinter XP-80C" className="text-sm" />
                                {!isDesktop && (
                                    <p className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1">
                                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <span>هذا حقل تذكيري في نسخة الويب. للطباعة المباشرة بدون نافذة، حمّل نسخة البرنامج المثبّت.</span>
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Paper size */}
                    <div>
                        <label className="text-sm font-semibold text-slate-800 mb-1.5 block">مقاس ورق الإيصال</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[{ k: "58mm", label: "حراري 58mm" }, { k: "80mm", label: "حراري 80mm" }, { k: "a4", label: "A4" }].map(o => (
                                <button key={o.k} onClick={() => setPaperSize(o.k)} data-testid={`paper-${o.k}`}
                                    className={`h-11 rounded-md border font-semibold text-sm transition-colors ${paperSize === o.k ? "bg-sky-600 text-white border-sky-700" : "bg-white text-slate-700 border-zinc-200 hover:bg-zinc-50"}`}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Copies */}
                    <div>
                        <label className="text-sm font-semibold text-slate-800 mb-1.5 block">عدد النسخ لكل فاتورة</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCopies(c => Math.max(1, c - 1))} data-testid="copies-minus"
                                className="h-10 w-10 rounded-md bg-zinc-100 hover:bg-zinc-200 text-slate-900 font-bold text-lg">−</button>
                            <div className="h-10 w-16 rounded-md bg-white border border-zinc-200 flex items-center justify-center tabular-nums font-bold text-lg" data-testid="copies-value">{copies}</div>
                            <button onClick={() => setCopies(c => Math.min(5, c + 1))} data-testid="copies-plus"
                                className="h-10 w-10 rounded-md bg-zinc-100 hover:bg-zinc-200 text-slate-900 font-bold text-lg">+</button>
                        </div>
                    </div>

                    {/* Auto-launch (desktop only) */}
                    {isDesktop && (
                        <div className="flex items-center justify-between p-4 rounded-md border border-violet-200 bg-violet-50">
                            <div>
                                <div className="font-semibold text-slate-900">تشغيل تلقائي عند بدء الحاسوب</div>
                                <p className="text-xs text-slate-500 mt-1">افتح العرّاب تلقائياً عند تشغيل النظام لسرعة بدء العمل</p>
                            </div>
                            <button onClick={() => setAutoLaunch(v => !v)} data-testid="setting-auto-launch"
                                className={`relative h-8 w-16 rounded-full transition-colors ${autoLaunch ? "bg-violet-500" : "bg-zinc-300"}`}>
                                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${autoLaunch ? "right-1" : "right-9"}`} />
                            </button>
                        </div>
                    )}

                    {/* Test button */}
                    <div className="pt-2 flex flex-wrap gap-2">
                        <Button onClick={printTest} data-testid="test-print-btn" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                            <Printer className="w-4 h-4" /> طباعة إيصال تجريبي الآن
                        </Button>
                        <div className="flex-1" />
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            {isDesktop ? "محفوظة على البرنامج المثبّت" : "الإعدادات محفوظة تلقائياً على هذا الجهاز"}
                        </div>
                    </div>
                </div>
            </section>

            {/* Download desktop installer */}
            {!isDesktop && (
                <section className="bg-gradient-to-l from-violet-50 to-white border border-violet-200 rounded-lg overflow-hidden">
                    <header className="flex items-center gap-3 px-5 h-14 border-b border-violet-200">
                        <Package className="w-5 h-5 text-violet-600" />
                        <h2 className="font-semibold text-slate-900">حمّل نسخة البرنامج المثبّت (العرّاب Desktop)</h2>
                    </header>
                    <div className="p-5 text-sm space-y-3 text-slate-800 leading-relaxed">
                        <p>نسخة سطح مكتب حقيقية مبنية بـ <b>Electron 32</b>، تُثبّت بضغطة واحدة وتتصل بالطابعة مباشرة كأي برنامج تقليدي.</p>
                        <ul className="list-disc pr-6 space-y-1 text-slate-700 text-[13px]">
                            <li>طباعة صامتة على الطابعة الافتراضية بدون نافذة اختيار.</li>
                            <li>يحفظ اختيار الطابعة والمقاس ونسخ الطباعة على البرنامج ذاته.</li>
                            <li>يعمل أوفلاين كاملاً + مزامنة تلقائية عند رجوع الإنترنت.</li>
                            <li>أيقونة على سطح المكتب + Auto-launch عند تشغيل الحاسوب.</li>
                            <li>تحديث تلقائي عن بُعد لكل نسخ المحلات دفعة واحدة.</li>
                        </ul>
                        <div className="mt-3 p-3 rounded-md bg-slate-900 text-slate-100 text-xs leading-relaxed">
                            <p className="font-bold text-emerald-300 mb-2">✓ الكود جاهز 100% في مجلد <span className="font-mono">/desktop</span></p>
                            <p>لتوليد ملفات التثبيت لكل منصة:</p>
                            <ol className="list-decimal pr-5 space-y-1 mt-1.5 text-slate-300">
                                <li>اضغط <b className="text-white">"Save to Github"</b> من أعلى واجهة Emergent.</li>
                                <li>من مستودع GitHub → <b className="text-white">Actions</b> → شغّل الـ workflow <span className="font-mono text-emerald-300">build-desktop</span>.</li>
                                <li>عند الانتهاء (~7 دقائق) ستجد في تبويب <b className="text-white">Artifacts</b>:
                                    <ul className="list-disc pr-5 mt-1 text-slate-400">
                                        <li><span className="font-mono text-white">Al-Arraab Setup 1.0.0.exe</span> (Windows) — installer + portable</li>
                                        <li><span className="font-mono text-white">Al-Arraab-1.0.0.dmg</span> (macOS)</li>
                                        <li><span className="font-mono text-white">Al-Arraab-1.0.0.AppImage</span> (Linux)</li>
                                    </ul>
                                </li>
                                <li>وزّع ملف التثبيت على أجهزة الكاشير — كل جهاز يفتحه ويسجّل دخول ببيانات المحل.</li>
                            </ol>
                        </div>
                        <p className="text-xs text-slate-500">للتحديث التلقائي لكل المحلات لاحقاً: <span className="font-mono bg-slate-100 px-1.5 rounded" dir="ltr">git tag v1.0.1 && git push --tags</span></p>
                    </div>
                </section>
            )}
        </div>
    );
}
