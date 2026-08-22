# تعليمات بناء برنامج Misk POS Desktop

## ✅ الكود جاهز 100% في مجلد `/desktop`

كل الملفات جاهزة:
- `desktop/main.js` — العملية الرئيسية (Electron)
- `desktop/preload.js` — الجسر الآمن بين البرنامج والواجهة
- `desktop/package.json` — إعدادات البناء لكل المنصات
- `.github/workflows/build-desktop.yml` — بناء آلي عبر GitHub

## 🚀 كيف تولّد ملفات التثبيت (.exe / .dmg / .AppImage)

### الطريقة الأولى: GitHub Actions (موصى بها — تبني كل المنصات دفعة واحدة)

1. **اضغط زر "Save to Github"** من أعلى واجهة Emergent (Ctrl/Cmd+S إن أمكن).
2. اذهب لمستودع GitHub الخاص بمشروعك → تبويب **Actions**.
3. اختر الـ workflow **build-desktop** → **Run workflow**.
4. انتظر ~7 دقائق حتى يكتمل البناء على Windows + macOS + Linux.
5. حمّل الملفات من تبويب **Artifacts**:
   - `misk-pos-windows-latest.zip` → داخلها `Misk POS Setup 1.0.0.exe` (installer) و `Misk POS 1.0.0.exe` (portable).
   - `misk-pos-macos-latest.zip` → داخلها `Misk POS-1.0.0.dmg`.
   - `misk-pos-ubuntu-latest.zip` → داخلها `Misk POS-1.0.0.AppImage` و `misk-pos_1.0.0_amd64.deb`.

### الطريقة الثانية: بناء محلي على جهازك

```bash
git clone <your-repo>
cd <your-repo>/desktop
npm install
npm run dist:win       # على Windows (يولّد .exe)
npm run dist:mac       # على macOS (يولّد .dmg)
npm run dist:linux     # على Linux (يولّد .AppImage و .deb)
```

## 📦 كيف يعمل البرنامج

عند تشغيل البرنامج على جهاز الكاشير:

1. **الاكتشاف التلقائي**: البرنامج يعلن نفسه للواجهة عبر `window.desktopAPI.isDesktop = true`.
2. **صفحة الإعدادات**: تُظهر قائمة الطابعات الفعلية المركّبة على النظام (Windows / macOS / Linux) — الكاشير يختار الطابعة بضغطة واحدة.
3. **الطباعة الصامتة**: عند حفظ فاتورة، البرنامج يستدعي `webContents.print({ silent: true, deviceName })` — الإيصال يخرج فوراً من الطابعة المُختارة دون أي نافذة.
4. **Auto-launch**: مفعّل افتراضياً — البرنامج يفتح مع تشغيل الحاسوب.
5. **تحديث تلقائي**: عند إصدار Tag جديد على GitHub (`git tag v1.0.1 && git push --tags`) كل نسخ المحلات تتحدّث في الخلفية عبر `electron-updater`.

## 🔧 تخصيص الشعار

استبدل `desktop/build/icon.png` بشعار المحل بحجم **512×512 PNG**.

## 🔐 التوقيع الرقمي (اختياري لكن موصى به)

للتوقيع بشهادة رسمية:
- **Windows**: أضف شهادة .pfx وضع بيانات الاعتماد في GitHub Secrets: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`.
- **macOS**: تحتاج Apple Developer ID وشهادة "Developer ID Application" — أضف `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` كـ GitHub Secrets.

بدون توقيع، البرنامج يعمل لكن نظام التشغيل قد يظهر تحذيراً في أول تشغيل.
