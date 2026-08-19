import { fmt } from "@/lib/api";

export function ReceiptPreview({ shop, sale, cashierName }) {
    if (!sale) return null;
    const dt = new Date(sale.created_at || Date.now());
    return (
        <div className="receipt-print bg-white" style={{ width: "80mm", padding: "6mm 4mm", fontFamily: "'IBM Plex Sans Arabic', monospace", color: "#000", fontSize: "12px", lineHeight: 1.3, direction: "rtl" }}>
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "16px", fontWeight: "700" }}>{shop?.name || "المحل"}</div>
                {shop?.phone && <div style={{ fontSize: "11px" }}>{shop.phone}</div>}
                {shop?.address && <div style={{ fontSize: "11px" }}>{shop.address}</div>}
            </div>
            <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0", marginBottom: "6px", fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>فاتورة</span><span className="tabular-nums">#{sale.invoice_no}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>التاريخ</span><span className="tabular-nums">{dt.toLocaleString("ar-EG")}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>الكاشير</span><span>{cashierName || sale.cashier_name}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>الزبون</span><span>{sale.customer_name || "نقدي"}</span></div>
            </div>
            <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                <thead>
                    <tr style={{ borderBottom: "1px solid #000" }}>
                        <th style={{ textAlign: "right", padding: "2px 0" }}>الصنف</th>
                        <th style={{ width: "30px", textAlign: "center" }}>ك</th>
                        <th style={{ width: "50px", textAlign: "left" }}>سعر</th>
                        <th style={{ width: "50px", textAlign: "left" }}>الكل</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items?.map((it, i) => (
                        <tr key={i}>
                            <td style={{ padding: "2px 0" }}>{it.name}</td>
                            <td style={{ textAlign: "center" }} className="tabular-nums">{it.qty}</td>
                            <td style={{ textAlign: "left" }} className="tabular-nums">{fmt(it.price)}</td>
                            <td style={{ textAlign: "left", fontWeight: "600" }} className="tabular-nums">{fmt(it.qty * it.price - (it.discount || 0))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div style={{ borderTop: "1px dashed #000", marginTop: "6px", paddingTop: "4px", fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>المجموع</span><span className="tabular-nums">{fmt(sale.subtotal)}</span></div>
                {sale.tax > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>الضريبة</span><span className="tabular-nums">{fmt(sale.tax)}</span></div>}
                {sale.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>الخصم</span><span className="tabular-nums">-{fmt(sale.discount)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: "700", borderTop: "1px solid #000", marginTop: "4px", paddingTop: "4px" }}>
                    <span>الإجمالي</span><span className="tabular-nums">{fmt(sale.total)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px" }}>
                    <span>طريقة الدفع</span>
                    <span>{sale.payment_method === "cash" ? "نقدي" : sale.payment_method === "card" ? "بطاقة" : "آجل"}</span>
                </div>
            </div>
            <div style={{ textAlign: "center", marginTop: "8px", fontSize: "10px", borderTop: "1px dashed #000", paddingTop: "6px" }}>
                <div>شكراً لتسوقكم معنا</div>
                <div style={{ fontFamily: "monospace", fontSize: "14px", marginTop: "3px" }}>*{sale.invoice_no}*</div>
            </div>
        </div>
    );
}

export function printReceipt(nodeId = "receipt-print-area") {
    const printContents = document.getElementById(nodeId)?.innerHTML;
    if (!printContents) return;
    const w = window.open("", "PRINT", "width=400,height=700");
    w.document.write(`
        <html dir="rtl"><head><title>Receipt #${Date.now()}</title>
        <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; font-family: 'IBM Plex Sans Arabic', sans-serif; }
            .tabular-nums { font-variant-numeric: tabular-nums; }
            @media print { body { margin: 0; } }
        </style>
        </head><body>${printContents}</body></html>
    `);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
}
