import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Printer, CheckCircle2, ExternalLink, Package, Info, Monitor, RefreshCw } from "lucide-react";
import { printReceipt } from "@/components/Receipt";
import { isDesktop, desktopAPI, silentPrintHTML } from "@/lib/desktop";

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
    const [printers, setPrinters] = useState([]);      // desktop only
    const [refreshing, setRefreshing] = useState(false);
    const [autoLaunch, setAutoLaunch] = useState(true);

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
                    <div className="font-bold text-slate-900">{isDesktop ? "برنامج سطح المكتب — Misk POS Desktop" : "وضع المتصفح"}</div>
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
                                <p className="text-xs text-slate-500 mt-1">افتح Misk POS تلقائياً عند تشغيل النظام لسرعة بدء العمل</p>
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
                        <h2 className="font-semibold text-slate-900">حمّل نسخة البرنامج المثبّت (Misk POS Desktop)</h2>
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
                                        <li><span className="font-mono text-white">Misk POS Setup 1.0.0.exe</span> (Windows) — installer + portable</li>
                                        <li><span className="font-mono text-white">Misk POS-1.0.0.dmg</span> (macOS)</li>
                                        <li><span className="font-mono text-white">Misk POS-1.0.0.AppImage</span> (Linux)</li>
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
