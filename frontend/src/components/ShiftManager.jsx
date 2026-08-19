import { useEffect, useState } from "react";
import { api, formatApiError, fmt } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, Play, StopCircle } from "lucide-react";

export function ShiftBadge({ shift, onOpen, onClose }) {
    if (!shift) {
        return (
            <button onClick={onOpen} data-testid="open-shift-btn" className="flex items-center gap-2 h-9 px-3 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors">
                <Play className="w-3.5 h-3.5" /> فتح وردية
            </button>
        );
    }
    return (
        <button onClick={onClose} data-testid="close-shift-btn" className="flex items-center gap-2 h-9 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors">
            <Clock className="w-3.5 h-3.5" /> وردية مفتوحة <span className="opacity-70">•</span>
            <span className="tabular-nums">{fmt(shift.opening_cash)}</span>
        </button>
    );
}

export function ShiftManager({ open, onOpenChange, shift, onDone }) {
    const [mode, setMode] = useState("open"); // open | close
    const [openingCash, setOpeningCash] = useState(0);
    const [closingCash, setClosingCash] = useState(0);
    const [summary, setSummary] = useState(null);

    useEffect(() => { if (open) { setMode(shift ? "close" : "open"); setSummary(null); setOpeningCash(0); setClosingCash(0); } }, [open, shift]);

    const doOpen = async () => {
        try { await api.post("/shifts/open", { opening_cash: openingCash }); toast.success("تم فتح الوردية"); onOpenChange(false); onDone?.(); }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const doClose = async () => {
        try {
            const { data } = await api.post("/shifts/close", { closing_cash: closingCash });
            setSummary(data.summary); toast.success("تم إغلاق الوردية");
        }
        catch (e) { toast.error(formatApiError(e)); }
    };
    const doneAndClose = () => { onOpenChange(false); onDone?.(); };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent dir="rtl" className="bg-white">
                <DialogHeader><DialogTitle>{mode === "open" ? "فتح وردية جديدة" : summary ? "ملخص الوردية" : "إغلاق الوردية"}</DialogTitle></DialogHeader>
                {mode === "open" && (
                    <div className="space-y-3">
                        <div><Label>النقد الافتتاحي (الفكة)</Label>
                            <Input type="number" value={openingCash} onChange={(e) => setOpeningCash(+e.target.value)} data-testid="opening-cash-input" autoFocus />
                            <p className="text-xs text-slate-500 mt-1">المبلغ النقدي الموجود في الصندوق عند بدء الوردية</p>
                        </div>
                    </div>
                )}
                {mode === "close" && !summary && (
                    <div className="space-y-4">
                        <div className="p-3 rounded-md bg-zinc-50 border text-sm space-y-1">
                            <div className="flex justify-between"><span className="text-slate-500">افتتح في</span><span className="tabular-nums">{shift?.opened_at?.substring(0,16).replace("T"," ")}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">نقد الافتتاح</span><span className="tabular-nums font-semibold">{fmt(shift?.opening_cash || 0)}</span></div>
                        </div>
                        <div><Label>النقد الفعلي في الصندوق</Label>
                            <Input type="number" value={closingCash} onChange={(e) => setClosingCash(+e.target.value)} data-testid="closing-cash-input" autoFocus />
                            <p className="text-xs text-slate-500 mt-1">قم بعدّ النقد فعلياً وأدخل المبلغ</p>
                        </div>
                    </div>
                )}
                {summary && (
                    <div className="space-y-3 text-sm">
                        <div className="p-4 rounded-md bg-zinc-50 border space-y-2">
                            <div className="flex justify-between"><span>عدد الفواتير</span><b className="tabular-nums">{summary.invoices_count}</b></div>
                            <div className="flex justify-between"><span>إجمالي المبيعات</span><b className="tabular-nums">{fmt(summary.total_sales)}</b></div>
                            <div className="flex justify-between"><span>مبيعات نقدية</span><b className="tabular-nums text-emerald-700">{fmt(summary.cash_sales)}</b></div>
                            <div className="flex justify-between"><span>مرتجعات</span><b className="tabular-nums text-rose-700">{fmt(summary.returns_total)}</b></div>
                            <div className="flex justify-between pt-2 border-t"><span>النقد المتوقع</span><b className="tabular-nums">{fmt(summary.expected_cash)}</b></div>
                            <div className="flex justify-between"><span>النقد الفعلي</span><b className="tabular-nums">{fmt(summary.closing_cash)}</b></div>
                            <div className={`flex justify-between text-lg pt-2 border-t ${summary.variance === 0 ? "" : summary.variance > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                <span className="font-semibold">الفرق</span>
                                <b className="tabular-nums">{summary.variance > 0 ? "+" : ""}{fmt(summary.variance)}</b>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 text-center">
                            {summary.variance === 0 ? "الصندوق مطابق تماماً" : summary.variance > 0 ? "زيادة في الصندوق" : "عجز في الصندوق"}
                        </p>
                    </div>
                )}
                <DialogFooter>
                    {mode === "open" && <Button onClick={doOpen} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="confirm-open-shift">فتح الوردية</Button>}
                    {mode === "close" && !summary && <Button onClick={doClose} className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="confirm-close-shift"><StopCircle className="w-4 h-4 ml-2" /> إغلاق الوردية</Button>}
                    {summary && <Button onClick={doneAndClose} className="bg-slate-900 hover:bg-slate-800 text-white">تم</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
