import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Printer, CheckCircle2, ExternalLink, Package, Info } from "lucide-react";
import { printReceipt } from "@/components/Receipt";

const PREF_KEYS = {
    autoPrint: "pos_auto_print",
    printerName: "pos_printer_name",
    paperSize: "pos_paper_size", // "58mm" | "80mm" | "a4"
    openDrawer: "pos_open_drawer",
    copies: "pos_print_copies",
};

function loadPref(k, dflt = "") {
    return localStorage.getItem(k) ?? dflt;
}

export default function Settings() {
    const { user } = useAuth();
    const [autoPrint, setAutoPrint] = useState(loadPref(PREF_KEYS.autoPrint) === "1");
    const [printerName, setPrinterName] = useState(loadPref(PREF_KEYS.printerName));
    const [paperSize, setPaperSize] = useState(loadPref(PREF_KEYS.paperSize, "80mm"));
    const [copies, setCopies] = useState(+loadPref(PREF_KEYS.copies, "1"));

    useEffect(() => { localStorage.setItem(PREF_KEYS.autoPrint, autoPrint ? "1" : "0"); }, [autoPrint]);
    useEffect(() => { localStorage.setItem(PREF_KEYS.printerName, printerName || ""); }, [printerName]);
    useEffect(() => { localStorage.setItem(PREF_KEYS.paperSize, paperSize); }, [paperSize]);
    useEffect(() => { localStorage.setItem(PREF_KEYS.copies, String(copies || 1)); }, [copies]);

    const printTest = () => {
        // Fill a temporary hidden slip and print it
        const el = document.createElement("div");
        el.id = "settings-test-print";
        el.style.cssText = "position:absolute;left:-9999px;top:0;";
        el.innerHTML = `
            <div style="width:${paperSize === 'a4' ? '210mm' : paperSize}; padding:6mm 4mm; font-family:'IBM Plex Sans Arabic', monospace; direction:rtl; color:#000">
                <div style="text-align:center; font-weight:700; font-size:16px;">${user?.shop?.name || "المحل"}</div>
                <div style="text-align:center; font-size:11px; margin-bottom:8px;">تجربة طباعة</div>
                <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; font-size:12px;">
                    <div style="display:flex; justify-content:space-between"><span>الطابعة</span><span>${printerName || "الافتراضية"}</span></div>
                    <div style="display:flex; justify-content:space-between"><span>مقاس الورق</span><span>${paperSize}</span></div>
                    <div style="display:flex; justify-content:space-between"><span>عدد النسخ</span><span>${copies}</span></div>
                    <div style="display:flex; justify-content:space-between"><span>التاريخ</span><span>${new Date().toLocaleString("en-GB")}</span></div>
                </div>
                <div style="text-align:center; margin-top:10px; font-size:13px; font-weight:700;">✓ الطباعة تعمل بنجاح</div>
            </div>`;
        document.body.appendChild(el);
        setTimeout(() => {
            printReceipt("settings-test-print");
            setTimeout(() => document.body.removeChild(el), 500);
        }, 50);
        toast.success("جاري إرسال إيصال تجربة للطابعة");
    };

    return (
        <div dir="rtl" className="space-y-6 max-w-4xl" data-testid="settings-page">
            {/* Printer Settings */}
            <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 bg-gradient-to-l from-sky-50 to-white">
                    <Printer className="w-5 h-5 text-sky-600" />
                    <h2 className="font-semibold text-slate-900">إعدادات الطابعة</h2>
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

                    {/* Printer name */}
                    <div>
                        <label className="text-sm font-semibold text-slate-800 mb-1.5 block">اسم الطابعة الافتراضية</label>
                        <Input value={printerName} onChange={(e) => setPrinterName(e.target.value)}
                            data-testid="setting-printer-name"
                            placeholder="مثال: XPrinter XP-80C" className="text-sm" />
                        <p className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>هذا حقل تذكيري فقط — الطابعة الفعلية تُختار من إعدادات نظام التشغيل (Windows / macOS / Linux). اضبط طابعة الإيصالات كطابعة افتراضية في النظام.</span>
                        </p>
                    </div>

                    {/* Paper size */}
                    <div>
                        <label className="text-sm font-semibold text-slate-800 mb-1.5 block">مقاس ورق الإيصال</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { k: "58mm", label: "حراري 58mm" },
                                { k: "80mm", label: "حراري 80mm" },
                                { k: "a4", label: "A4" },
                            ].map(o => (
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

                    {/* Test button */}
                    <div className="pt-2 flex flex-wrap gap-2">
                        <Button onClick={printTest} data-testid="test-print-btn" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                            <Printer className="w-4 h-4" /> طباعة إيصال تجريبي الآن
                        </Button>
                        <div className="flex-1" />
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            الإعدادات محفوظة تلقائياً على هذا الجهاز
                        </div>
                    </div>
                </div>
            </section>

            {/* Silent print instructions */}
            <section className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 bg-gradient-to-l from-amber-50 to-white">
                    <Info className="w-5 h-5 text-amber-600" />
                    <h2 className="font-semibold text-slate-900">طباعة صامتة 100% (بدون نافذة تأكيد)</h2>
                </header>
                <div className="p-5 space-y-3 text-sm">
                    <p className="text-slate-700 leading-relaxed">افتح المتصفح Chrome من اختصار مخصّص لتفعيل الوضع المباشر:</p>
                    <ol className="list-decimal pr-6 space-y-2 text-slate-800">
                        <li>في <b>Windows</b>: انقر بيمين الفأرة على سطح المكتب → "اختصار جديد"، والصق المسار:
                            <div dir="ltr" className="font-mono bg-slate-900 text-emerald-300 text-[12px] p-3 rounded mt-1.5 select-all overflow-x-auto">"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=https://point-control-2.preview.emergentagent.com</div>
                        </li>
                        <li>في <b>macOS / Linux</b>: أنشئ launcher أو ضع أمر في Terminal:
                            <div dir="ltr" className="font-mono bg-slate-900 text-emerald-300 text-[12px] p-3 rounded mt-1.5 select-all overflow-x-auto">google-chrome --kiosk-printing --app=https://point-control-2.preview.emergentagent.com</div>
                        </li>
                        <li>افتح النظام من الاختصار الجديد وسجّل دخول — أي طباعة ستذهب مباشرة للطابعة الافتراضية دون نافذة اختيار.</li>
                    </ol>
                </div>
            </section>

            {/* Native app roadmap */}
            <section className="bg-gradient-to-l from-violet-50 to-white border border-violet-200 rounded-lg overflow-hidden">
                <header className="flex items-center gap-3 px-5 h-14 border-b border-violet-200">
                    <Package className="w-5 h-5 text-violet-600" />
                    <h2 className="font-semibold text-slate-900">هل تريد نسخة برنامج مثبّت لكل محل؟</h2>
                </header>
                <div className="p-5 text-sm space-y-3 text-slate-800 leading-relaxed">
                    <p>نستطيع تحويل النظام إلى <b>برنامج سطح مكتب حقيقي (Windows / macOS)</b> يُثبَّت بملف <span dir="ltr" className="font-mono bg-slate-100 px-1.5 rounded">.exe</span> أو <span dir="ltr" className="font-mono bg-slate-100 px-1.5 rounded">.dmg</span> ويتصل بالطابعة مباشرة مثل برامج الكاشير التقليدية، دون الحاجة إلى Chrome.</p>
                    <ul className="list-disc pr-6 space-y-1 text-slate-700 text-[13px]">
                        <li>يتذكّر الطابعة الافتراضية للمحل ويطبع بضغطة واحدة دون أي نافذة.</li>
                        <li>يعمل أوفلاين كاملاً + يتصل تلقائياً بالخادم عند الإنترنت.</li>
                        <li>أيقونة على سطح المكتب + Auto-launch عند تشغيل الحاسوب.</li>
                        <li>تحديث تلقائي عن بُعد لكل نسخ المحلات دفعة واحدة.</li>
                    </ul>
                    <div className="mt-3 flex items-center gap-2">
                        <a href="https://wa.me/970591234567?text=نريد%20نسخة%20البرنامج%20المثبّت%20للمحل" target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-sm transition-colors">
                            <ExternalLink className="w-4 h-4" /> اطلب حزمة التثبيت
                        </a>
                        <p className="text-[11px] text-slate-500">سنبني لك نسخة Electron/Tauri موقّعة رقمياً بالخطوة التالية عند طلبك.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
