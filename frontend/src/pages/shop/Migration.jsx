import { useState, useRef } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Upload, Sparkles, ArrowRight, CheckCircle2, AlertCircle, Package, Users, Truck,
    FileSpreadsheet, Loader2, Wand2
} from "lucide-react";

const ENTITIES = [
    { id: "products", label: "المنتجات + المخزون", icon: Package, color: "sky",
      desc: "أسماء الأصناف، الباركود، الأسعار، الكميات، الفئات" },
    { id: "customers", label: "العملاء", icon: Users, color: "emerald",
      desc: "بيانات الزبائن والأرصدة الافتتاحية" },
    { id: "suppliers", label: "الموردين", icon: Truck, color: "amber",
      desc: "بيانات الموردين والأرصدة الافتتاحية" },
];

const STEPS = ["اختر النوع", "ارفع الملف", "راجع الربط الذكي", "استيراد"];

export default function Migration() {
    const [step, setStep] = useState(0);
    const [entity, setEntity] = useState("");
    const [file, setFile] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [mapping, setMapping] = useState({});
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const fileRef = useRef(null);

    const chooseEntity = (id) => { setEntity(id); setStep(1); };
    const onFile = (f) => { if (f) { setFile(f); } };

    const analyze = async () => {
        if (!file || !entity) return;
        setAnalyzing(true);
        try {
            const fd = new FormData(); fd.append("file", file);
            const { data } = await api.post(`/migration/analyze?entity=${entity}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            setAnalysis(data); setMapping(data.suggested_mapping || {}); setStep(2);
            toast.success(`تمّ تحليل الملف — ${data.row_count} سطر`);
        } catch (e) { toast.error(formatApiError(e)); }
        setAnalyzing(false);
    };

    const doImport = async () => {
        setImporting(true);
        try {
            const fd = new FormData(); fd.append("file", file);
            const { data } = await api.post(`/migration/import?entity=${entity}&mapping=${encodeURIComponent(JSON.stringify(mapping))}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            setResult(data); setStep(3);
            toast.success(`تمّ استيراد ${data.imported} سجل`);
        } catch (e) { toast.error(formatApiError(e)); }
        setImporting(false);
    };

    const reset = () => { setStep(0); setEntity(""); setFile(null); setAnalysis(null); setMapping({}); setResult(null); };

    const schema = analysis?.schema;
    const targetOptions = schema ? [{ key: "ignore", label: "— تجاهل —" }, ...Object.entries(schema.fields).map(([k, v]) => ({ key: k, label: v }))] : [];
    const requiredMissing = schema ? schema.required.filter(r => !Object.values(mapping).includes(r)) : [];

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Steps header */}
            <div className="flex items-center gap-2">
                {STEPS.map((label, i) => (
                    <div key={i} className="flex items-center gap-2 flex-1">
                        <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold transition-colors ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-slate-900 text-white" : "bg-zinc-200 text-slate-500"}`}>
                            {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                        </div>
                        <div className={`text-sm ${i === step ? "font-semibold text-slate-900" : "text-slate-500"}`}>{label}</div>
                        {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-emerald-500" : "bg-zinc-200"}`} />}
                    </div>
                ))}
            </div>

            <Card className="p-6 border-zinc-200">
                {/* Step 0 - Entity picker */}
                {step === 0 && (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Wand2 className="w-5 h-5 text-blue-600" /> نقل ذكي من نظامك القديم</h3>
                            <p className="text-sm text-slate-500 mt-1">صدّر بياناتك من أي نظام كاشير قديم (العربي، مسك، بيت المحاسب، Excel/CSV) وسنقوم بربط الأعمدة تلقائياً بالذكاء الاصطناعي.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {ENTITIES.map(e => {
                                const bg = { sky: "border-sky-300 bg-sky-50 text-sky-900", emerald: "border-emerald-300 bg-emerald-50 text-emerald-900", amber: "border-amber-300 bg-amber-50 text-amber-900" }[e.color];
                                return (
                                    <button key={e.id} onClick={() => chooseEntity(e.id)} data-testid={`entity-${e.id}`}
                                        className={`p-5 rounded-lg border-2 text-right transition-all hover:shadow-md ${bg}`}>
                                        <e.icon className="w-10 h-10 mb-3" />
                                        <div className="font-bold text-lg">{e.label}</div>
                                        <div className="text-xs opacity-70 mt-1">{e.desc}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 1 - Upload */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">ارفع ملف {ENTITIES.find(e => e.id === entity)?.label}</h3>
                            <Button variant="outline" size="sm" onClick={reset}>رجوع</Button>
                        </div>
                        <div
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
                            className="border-2 border-dashed border-zinc-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-colors">
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="migration-file-input" />
                            <FileSpreadsheet className="w-16 h-16 mx-auto text-zinc-400 mb-3" />
                            {file ? (
                                <div>
                                    <div className="font-semibold text-slate-900">{file.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
                                </div>
                            ) : (
                                <div>
                                    <div className="font-semibold text-slate-900">اسحب الملف هنا أو اضغط للاختيار</div>
                                    <div className="text-xs text-slate-500 mt-1">Excel (.xlsx) أو CSV</div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={analyze} disabled={!file || analyzing} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="analyze-btn">
                                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {analyzing ? "جارٍ التحليل بالذكاء الاصطناعي…" : "تحليل ذكي وربط الأعمدة"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 2 - Mapping review */}
                {step === 2 && analysis && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-blue-600" /> الربط الذكي</h3>
                                <p className="text-xs text-slate-500 mt-1">راجع الأعمدة المُقترحة — عدّل ما تراه ضرورياً قبل الاستيراد.</p>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {analysis.row_count} سطر</Badge>
                        </div>

                        {requiredMissing.length > 0 && (
                            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-900 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5" />
                                <div>الحقول الإجبارية التالية غير مربوطة: <b>{requiredMissing.map(k => schema.fields[k]).join("، ")}</b></div>
                            </div>
                        )}

                        <div className="border border-zinc-200 rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50 text-right text-xs text-slate-600">
                                    <tr><th className="p-2.5">عمود المصدر</th><th className="p-2.5 w-12 text-center">→</th><th className="p-2.5">يُربط بحقل</th><th className="p-2.5">عيّنة</th></tr>
                                </thead>
                                <tbody>
                                    {analysis.headers.map(h => {
                                        const target = mapping[h] || "ignore";
                                        const sample = analysis.sample_rows[0]?.[h];
                                        return (
                                            <tr key={h} className="border-t border-zinc-100">
                                                <td className="p-2.5 font-semibold text-slate-900">{h}</td>
                                                <td className="p-2.5 text-center text-slate-400"><ArrowRight className="w-4 h-4 mx-auto rotate-180" /></td>
                                                <td className="p-2.5">
                                                    <select value={target} onChange={(e) => setMapping(m => ({...m, [h]: e.target.value}))}
                                                        data-testid={`map-${h}`}
                                                        className={`h-9 rounded border px-2 bg-white text-sm min-w-48 ${target === "ignore" ? "border-zinc-200 text-slate-400" : "border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold"}`}>
                                                        {targetOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-2.5 text-slate-500 truncate max-w-xs">{sample != null ? String(sample) : "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between">
                            <Button variant="outline" onClick={() => setStep(1)}>رجوع</Button>
                            <Button onClick={doImport} disabled={importing || requiredMissing.length > 0} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" data-testid="do-import-btn">
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {importing ? "جارٍ الاستيراد…" : "بدء الاستيراد"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3 - Result */}
                {step === 3 && result && (
                    <div className="space-y-4 text-center">
                        <CheckCircle2 className="w-20 h-20 mx-auto text-emerald-500" />
                        <h3 className="text-2xl font-bold text-slate-900">تمّ الاستيراد بنجاح</h3>
                        <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
                            <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200"><div className="text-3xl font-bold text-emerald-700 tabular-nums">{result.imported}</div><div className="text-xs text-emerald-800 mt-1">سجل مُستورد</div></div>
                            <div className="p-4 rounded-md bg-zinc-50 border border-zinc-200"><div className="text-3xl font-bold text-slate-700 tabular-nums">{result.total_rows}</div><div className="text-xs text-slate-600 mt-1">إجمالي الأسطر</div></div>
                            <div className="p-4 rounded-md bg-rose-50 border border-rose-200"><div className="text-3xl font-bold text-rose-700 tabular-nums">{result.errors?.length || 0}</div><div className="text-xs text-rose-800 mt-1">أخطاء</div></div>
                        </div>
                        {result.errors?.length > 0 && (
                            <div className="text-right max-w-2xl mx-auto p-3 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-900">
                                <div className="font-semibold mb-1">أول {Math.min(5, result.errors.length)} خطأ:</div>
                                <ul className="list-disc pr-5 space-y-0.5">
                                    {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            </div>
                        )}
                        <Button onClick={reset} className="bg-slate-900 hover:bg-slate-800 text-white gap-2" data-testid="restart-migration"><Wand2 className="w-4 h-4" /> استيراد نوع آخر</Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
