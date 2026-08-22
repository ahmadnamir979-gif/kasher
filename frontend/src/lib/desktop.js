// Detect the Electron desktop wrapper and expose helpers.
export const isDesktop = typeof window !== "undefined" && !!window.desktopAPI?.isDesktop;
export const desktopAPI = typeof window !== "undefined" ? window.desktopAPI : null;

/**
 * Print HTML silently to the user's default (or configured) printer when running
 * inside the Electron desktop app. Falls back to window.print() in the browser.
 */
export async function silentPrintHTML({ html, deviceName, copies = 1, paperSize = "80mm" }) {
    if (isDesktop && desktopAPI?.silentPrint) {
        return await desktopAPI.silentPrint({ html, deviceName, copies, paperSize });
    }
    // Web fallback: open a hidden iframe with the HTML and call print()
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:absolute;left:-9999px;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    frame.contentDocument.write(`<!doctype html><html dir="rtl"><head><style>@page{size:${paperSize === "a4" ? "210mm 297mm" : paperSize + " 297mm"};margin:0;}body{margin:0;font-family:'IBM Plex Sans Arabic',sans-serif}</style></head><body>${html}</body></html>`);
    frame.contentDocument.close();
    for (let i = 0; i < copies; i++) {
        await new Promise((r) => setTimeout(r, 300));
        try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch {}
    }
    setTimeout(() => document.body.removeChild(frame), 1500);
    return { ok: true };
}
