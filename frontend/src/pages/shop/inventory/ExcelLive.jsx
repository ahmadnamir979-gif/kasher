import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, RefreshCw, Copy, Trash2, Info, FileSpreadsheet, Shield } from "lucide-react";
import { toast } from "sonner";

export default function ExcelLive() {
    const [token, setToken] = useState(null);
    const [tokenAt, setTokenAt] = useState(null);
    const [entities, setEntities] = useState([]);
    const [helpOpen, setHelpOpen] = useState(false);
    const backend = process.env.REACT_APP_BACKEND_URL;

    const load = async () => {
        try {
            const [t, e] = await Promise.all([
                api.get("/live-data/token"),
                api.get("/live-data/entities"),
            ]);
            setToken(t.data.token);
            setTokenAt(t.data.generated_at);
            setEntities(e.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };
    useEffect(() => { load(); }, []);

    const rotate = async () => {
        if (token && !window.confirm("توليد رمز جديد سيبطل الروابط القديمة على Excel. متابعة؟")) return;
        try {
            const r = await api.post("/live-data/token/rotate");
            setToken(r.data.token);
            setTokenAt(r.data.generated_at);
            toast.success("تم توليد رمز جديد");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const revoke = async () => {
        if (!window.confirm("إلغاء الرمز بالكامل؟ Excel لن يستطيع سحب البيانات بعد الآن.")) return;
        try {
            await api.delete("/live-data/token");
            setToken(null); setTokenAt(null);
            toast.success("تم إلغاء الرمز");
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const copy = (txt) => {
        navigator.clipboard.writeText(txt);
        toast.success("تم النسخ");
    };

    const csvUrl = (key) => `${backend}/api/live/${key}.csv?token=${token || "YOUR_TOKEN"}`;
    const jsonUrl = (key) => `${backend}/api/live/${key}.json?token=${token || "YOUR_TOKEN"}`;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">الربط المباشر مع Microsoft Excel</h2>
                    <p className="text-sm text-slate-500">اسحب بيانات محلك مباشرةً إلى Excel بدون تصدير — Excel يحدّث نفسه تلقائياً</p>
                </div>
                <Button variant="outline" onClick={() => setHelpOpen(true)} className="gap-1" data-testid="excel-help-btn"><Info className="w-4 h-4" />كيف أربط Excel؟</Button>
            </div>

            <Card className="p-6 border-zinc-200 bg-gradient-to-br from-emerald-50 to-white">
                <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <div className="flex-1">
                        <h3 className="font-bold">رمز الوصول للبيانات (Data Token)</h3>
                        <p className="text-xs text-slate-500">
                            {token ? `تم توليده في: ${tokenAt?.slice(0, 16).replace("T", " ")}` : "لم يتم توليد رمز بعد"}
                        </p>
                    </div>
                    {token ? (
                        <>
                            <Button variant="outline" onClick={rotate} className="gap-1" data-testid="excel-rotate"><RefreshCw className="w-4 h-4" />تدوير</Button>
                            <Button variant="outline" onClick={revoke} className="gap-1 text-rose-600" data-testid="excel-revoke"><Trash2 className="w-4 h-4" />إلغاء</Button>
                        </>
                    ) : (
                        <Button onClick={rotate} className="bg-emerald-600 hover:bg-emerald-700 gap-1" data-testid="excel-generate"><RefreshCw className="w-4 h-4" />توليد رمز</Button>
                    )}
                </div>
                {token && (
                    <div className="p-3 bg-slate-900 text-emerald-300 rounded-lg font-mono text-xs break-all flex items-center gap-2" data-testid="excel-token">
                        <div className="flex-1">{token}</div>
                        <Button size="sm" variant="ghost" onClick={() => copy(token)} className="text-emerald-300 hover:text-emerald-100"><Copy className="w-4 h-4" /></Button>
                    </div>
                )}
                <div className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
                    ⚠️ الرمز يعطي وصولاً للقراءة فقط لبيانات محلك. لا تشاركه علناً. اضغط "تدوير" إذا شككت بأنه سُرِّب.
                </div>
            </Card>

            <Card className="border-zinc-200">
                <div className="p-4 border-b flex items-center gap-3">
                    <Table className="w-5 h-5 text-slate-600" />
                    <div className="flex-1">
                        <h3 className="font-bold">روابط البيانات ({entities.length})</h3>
                        <p className="text-xs text-slate-500">انسخ الرابط والصقه في Excel: Data → From Web</p>
                    </div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-zinc-50 border-b text-right text-xs">
                        <tr><th className="p-3">الكيان</th><th className="p-3">رابط CSV (للـ Excel)</th><th className="p-3">JSON</th></tr>
                    </thead>
                    <tbody>
                        {entities.map(e => (
                            <tr key={e.key} className="border-b border-zinc-100" data-testid={`live-row-${e.key}`}>
                                <td className="p-3 font-semibold"><Badge variant="outline">{e.label}</Badge></td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-xs bg-zinc-100 px-2 py-1 rounded truncate max-w-md" dir="ltr">{csvUrl(e.key)}</code>
                                        <Button size="sm" variant="ghost" onClick={() => copy(csvUrl(e.key))} disabled={!token} data-testid={`live-copy-${e.key}`}><Copy className="w-4 h-4" /></Button>
                                    </div>
                                </td>
                                <td className="p-3">
                                    <Button size="sm" variant="ghost" onClick={() => copy(jsonUrl(e.key))} disabled={!token}><Copy className="w-4 h-4" /></Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" />خطوات ربط Excel مع بيانات المحل</DialogTitle></DialogHeader>
                    <div className="space-y-4 text-sm">
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <b>الخطوة 1:</b> ولّد رمزاً من الأعلى ثم انسخ رابط CSV للكيان الذي تريده (مثلاً "المبيعات").
                        </div>
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <b>الخطوة 2 في Excel:</b>
                            <ol className="list-decimal mr-6 mt-2 space-y-1">
                                <li>افتح ملف Excel جديد</li>
                                <li>من القائمة العلوية اختر <b>Data (بيانات)</b> → <b>From Web (من الويب)</b></li>
                                <li>الصق الرابط الذي نسخته</li>
                                <li>اضغط <b>OK</b> → ثم <b>Load (تحميل)</b></li>
                            </ol>
                        </div>
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <b>الخطوة 3: تحديث تلقائي</b>
                            <ol className="list-decimal mr-6 mt-2 space-y-1">
                                <li>من قائمة <b>Data</b> اختر <b>Queries & Connections</b></li>
                                <li>اضغط بالزر الأيمن على الاستعلام → <b>Properties</b></li>
                                <li>فعّل <b>Refresh every N minutes</b> — مثلاً كل 5 دقائق</li>
                                <li>الآن Excel يحدّث البيانات تلقائياً</li>
                            </ol>
                        </div>
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <b>Pivot Tables:</b> بعد تحميل البيانات، اختر الجدول → <b>Insert</b> → <b>PivotTable</b> واصنع تقاريرك التفاعلية.
                        </div>
                        <div className="p-4 bg-slate-100 rounded-lg">
                            <b>Google Sheets؟</b> استخدم دالة: <code className="bg-white px-1 rounded">=IMPORTDATA("رابط_CSV")</code>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
