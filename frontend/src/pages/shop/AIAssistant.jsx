import { useEffect, useState, useRef } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Send, Loader2, TrendingUp, MessageSquare, Bell, BellOff, RefreshCw, Settings2, TrendingDown, Wallet, Package, AlertCircle, AlertTriangle, Clock, Receipt as ReceiptIcon, Users, Landmark, Phone } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = [
    "شو مبيعاتي اليوم؟",
    "أكثر منتج ربحاً هالشهر؟",
    "كم إجمالي الديون المستحقة عليّ من الزبائن؟",
    "قدّيش مصروف الرواتب هالشهر؟",
    "شو حالة المخزون؟",
];

const SEVERITY_META = {
    success: { color: "bg-emerald-50 border-emerald-300 text-emerald-900" },
    info: { color: "bg-blue-50 border-blue-300 text-blue-900" },
    warning: { color: "bg-amber-50 border-amber-300 text-amber-900" },
    danger: { color: "bg-rose-50 border-rose-300 text-rose-900" },
};

const ICON_MAP = {
    "trending-up": TrendingUp,
    "trending-down": TrendingDown,
    "wallet": Wallet,
    "landmark": Landmark,
    "package": Package,
    "alert-circle": AlertCircle,
    "alert-triangle": AlertTriangle,
    "clock": Clock,
    "receipt": ReceiptIcon,
    "users": Users,
};

export default function AIAssistant() {
    const [messages, setMessages] = useState([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(false);
    const [sid, setSid] = useState(null);
    const [insights, setInsights] = useState(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [settings, setSettings] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const bottomRef = useRef();

    const loadInsights = async (refresh = false) => {
        setInsightsLoading(true);
        try {
            const r = await api.get("/ai/insights", { params: { refresh } });
            setInsights(r.data);
        } catch (e) { toast.error(formatApiError(e)); }
        finally { setInsightsLoading(false); }
    };

    const loadSettings = async () => {
        try { const r = await api.get("/ai/insights/settings"); setSettings(r.data); }
        catch (e) { toast.error(formatApiError(e)); }
    };

    useEffect(() => {
        api.get("/ai/history?limit=10").then(r => {
            const hist = r.data.reverse();
            const msgs = [];
            hist.forEach(h => {
                msgs.push({ role: "user", text: h.question, at: h.created_at });
                msgs.push({ role: "ai", text: h.answer, chart: h.chart, at: h.created_at });
            });
            setMessages(msgs);
        }).catch(() => { });
        loadInsights(false);
        loadSettings();
    }, []);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const ask = async (question) => {
        if (!question.trim()) return;
        setMessages(m => [...m, { role: "user", text: question }]);
        setQ("");
        setLoading(true);
        try {
            const r = await api.post("/ai/ask", { question, session_id: sid });
            setSid(r.data.session_id);
            setMessages(m => [...m, { role: "ai", text: r.data.answer, chart: r.data.chart }]);
        } catch (e) {
            const msg = formatApiError(e);
            setMessages(m => [...m, { role: "ai", text: `عذراً، حدث خطأ: ${msg}`, error: true }]);
            toast.error(msg);
        } finally { setLoading(false); }
    };

    const toggleInsights = async () => {
        if (!settings) return;
        const newVal = !settings.enabled;
        try {
            await api.put("/ai/insights/settings", { ...settings, enabled: newVal });
            setSettings(s => ({ ...s, enabled: newVal }));
            toast.success(newVal ? "تم تفعيل التنبيهات الاستباقية" : "تم إيقاف التنبيهات");
            loadInsights(newVal);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const sendWhatsApp = async () => {
        try {
            const r = await api.get("/ai/insights/whatsapp-link");
            if (r.data.alerts_count === 0) {
                toast.info("لا تنبيهات حرجة لإرسالها");
                return;
            }
            window.open(r.data.url, "_blank");
            toast.success(`فتح واتساب مع ${r.data.alerts_count} تنبيه`);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const saveSettings = async () => {
        try {
            await api.put("/ai/insights/settings", settings);
            toast.success("تم الحفظ");
            setSettingsOpen(false);
            loadInsights(true);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const Chart = ({ chart }) => {
        if (!chart || !chart.values || !chart.labels) return null;
        const max = Math.max(...chart.values, 1);
        return (
            <Card className="mt-2 p-3 border-amber-200 bg-amber-50/40">
                <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1"><TrendingUp className="w-3 h-3" />{chart.title}</div>
                <div className="space-y-1">
                    {chart.labels.map((l, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                            <div className="w-24 truncate">{l}</div>
                            <div className="flex-1 bg-amber-100 rounded overflow-hidden h-5">
                                <div className="bg-amber-500 h-full flex items-center justify-end px-2 text-white text-xs font-semibold" style={{ width: `${(chart.values[i] / max) * 100}%` }}>
                                    {fmt(chart.values[i])}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
            <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                    <h2 className="text-xl font-bold">المساعد الذكي</h2>
                    <p className="text-sm text-slate-500">اسأل عن محلك بالعربية — GPT مربوط ببياناتك مباشرة</p>
                </div>
                {settings && (
                    <>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white">
                            {settings.enabled ? <Bell className="w-4 h-4 text-emerald-600" /> : <BellOff className="w-4 h-4 text-slate-400" />}
                            <span className="text-sm">التنبيهات الاستباقية</span>
                            <button
                                onClick={toggleInsights}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${settings.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                                data-testid="insights-toggle"
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${settings.enabled ? "-translate-x-5" : "-translate-x-1"}`} />
                            </button>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} data-testid="insights-settings-btn"><Settings2 className="w-4 h-4" /></Button>
                    </>
                )}
            </div>

            {settings?.enabled && insights && (
                <Card className="border-zinc-200">
                    <div className="p-3 border-b bg-gradient-to-l from-amber-50 to-white flex items-center gap-3">
                        <Bell className="w-5 h-5 text-amber-600" />
                        <div className="flex-1">
                            <div className="font-bold text-sm">تنبيهات ذكية استباقية ({insights.alerts?.length || 0})</div>
                            <div className="text-xs text-slate-500">آخر تحديث: {insights.computed_at?.slice(0, 16).replace("T", " ") || "-"} {insights.fresh && <Badge variant="outline" className="text-emerald-700 border-emerald-300 mr-1">جديد</Badge>}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => loadInsights(true)} disabled={insightsLoading} className="gap-1" data-testid="insights-refresh">
                            {insightsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}تحديث
                        </Button>
                        {settings?.owner_whatsapp && (insights?.alerts || []).some(a => a.severity === "danger" || a.severity === "warning") && (
                            <Button size="sm" onClick={sendWhatsApp} className="bg-green-600 hover:bg-green-700 text-white gap-1" data-testid="insights-wa-btn">
                                <Phone className="w-3 h-3" />أرسل على واتساب
                            </Button>
                        )}
                    </div>
                    <div className="p-3 max-h-[220px] overflow-y-auto space-y-2">
                        {(insights.alerts || []).length === 0 && (
                            <div className="text-center py-6 text-sm text-slate-400">لا تنبيهات حالياً — كل شي تحت السيطرة ✓</div>
                        )}
                        {(insights.alerts || []).map((a, i) => {
                            const Icon = ICON_MAP[a.icon] || Sparkles;
                            const meta = SEVERITY_META[a.severity] || SEVERITY_META.info;
                            return (
                                <div key={i} className={`p-3 rounded-lg border ${meta.color} flex items-start gap-3`} data-testid={`insight-${i}`}>
                                    <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div className="flex-1 text-sm">
                                        <div className="font-bold">{a.title}</div>
                                        <div className="text-xs opacity-80 mt-1">{a.detail}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            <Card className="flex-1 border-zinc-200 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 && (
                        <div className="text-center py-12 space-y-4">
                            <MessageSquare className="w-16 h-16 text-amber-500/40 mx-auto" />
                            <div className="text-slate-500">ابدأ بسؤال، أو جرّب أحد هذه الأسئلة:</div>
                            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                                {SUGGESTIONS.map((s, i) => (
                                    <Button key={i} variant="outline" size="sm" onClick={() => ask(s)} className="text-xs" data-testid={`ai-sug-${i}`}>{s}</Button>
                                ))}
                            </div>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-2xl p-3 rounded-2xl ${m.role === "user" ? "bg-amber-500 text-white" : m.error ? "bg-rose-50 border border-rose-200" : "bg-zinc-100"}`} data-testid={`ai-msg-${i}`}>
                                <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                                {m.chart && <Chart chart={m.chart} />}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-end">
                            <div className="bg-zinc-100 p-3 rounded-2xl flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                <span className="text-sm text-slate-500">يفكّر...</span>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef}></div>
                </div>
                <div className="p-3 border-t bg-zinc-50 flex gap-2">
                    <Input
                        value={q} onChange={e => setQ(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && ask(q)}
                        placeholder="اكتب سؤالك بالعربية..."
                        disabled={loading}
                        className="flex-1"
                        data-testid="ai-input"
                    />
                    <Button onClick={() => ask(q)} disabled={!q.trim() || loading} className="bg-amber-500 hover:bg-amber-600 gap-1" data-testid="ai-send">
                        <Send className="w-4 h-4" />إرسال
                    </Button>
                </div>
            </Card>

            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>إعدادات التنبيهات الاستباقية</DialogTitle></DialogHeader>
                    {settings && (
                        <div className="space-y-3">
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                                <label className="flex items-center gap-2 font-semibold text-green-800">
                                    <Phone className="w-4 h-4" />
                                    التنبيهات الحرجة على واتساب صاحب المحل
                                </label>
                                <Input
                                    placeholder="+972501234567 أو 0501234567"
                                    dir="ltr"
                                    value={settings.owner_whatsapp || ""}
                                    onChange={e => setSettings(s => ({ ...s, owner_whatsapp: e.target.value }))}
                                    data-testid="insights-wa-phone"
                                />
                                <div className="text-xs text-green-700">أضف رقمك ليظهر زر "أرسل على واتساب" — يفتح واتساب برسالة تحوي كل التنبيهات الحرجة جاهزة للإرسال.</div>
                            </div>
                            <div><label className="text-xs">نسبة تغير المبيعات لإطلاق تنبيه (%)</label><Input type="number" step="1" value={settings.sales_change_threshold} onChange={e => setSettings(s => ({ ...s, sales_change_threshold: Number(e.target.value) }))} /></div>
                            <div><label className="text-xs">نسبة تغير المصاريف (%)</label><Input type="number" step="1" value={settings.expense_change_threshold} onChange={e => setSettings(s => ({ ...s, expense_change_threshold: Number(e.target.value) }))} /></div>
                            <div><label className="text-xs">حد المخزون المنخفض للأصناف الرائجة</label><Input type="number" min="1" value={settings.stock_low_threshold} onChange={e => setSettings(s => ({ ...s, stock_low_threshold: Number(e.target.value) }))} /></div>
                            <div><label className="text-xs">حد السيولة المنخفضة</label><Input type="number" step="1" value={settings.cash_low_threshold} onChange={e => setSettings(s => ({ ...s, cash_low_threshold: Number(e.target.value) }))} /></div>
                            <div><label className="text-xs">أيام مقدمة لتنبيه الشيكات المستحقة</label><Input type="number" min="1" value={settings.check_due_days} onChange={e => setSettings(s => ({ ...s, check_due_days: Number(e.target.value) }))} /></div>
                            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border">
                                يتم حساب التنبيهات تلقائياً كل 6 ساعات، أو عند الضغط على "تحديث".
                            </div>
                        </div>
                    )}
                    <DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>إلغاء</Button><Button onClick={saveSettings} data-testid="insights-save">حفظ</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
