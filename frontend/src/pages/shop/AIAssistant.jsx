import { useEffect, useState, useRef } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, TrendingUp, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = [
    "شو مبيعاتي اليوم؟",
    "أكثر منتج ربحاً هالشهر؟",
    "كم إجمالي الديون المستحقة عليّ من الزبائن؟",
    "قدّيش مصروف الرواتب هالشهر؟",
    "شو حالة المخزون؟",
];

export default function AIAssistant() {
    const [messages, setMessages] = useState([]);
    const [q, setQ] = useState("");
    const [loading, setLoading] = useState(false);
    const [sid, setSid] = useState(null);
    const bottomRef = useRef();

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
            </div>

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
        </div>
    );
}
