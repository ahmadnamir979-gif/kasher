# تعليمات بناء برنامج العرّاب Desktop

## ✅ الكود جاهز 100% في مجلد `/desktop`

كل الملفات جاهزة:
- `desktop/main.js` — العملية الرئيسية (Electron) — يستخدم `https://al3rab.shop` افتراضياً
- `desktop/preload.js` — الجسر الآمن بين البرنامج والواجهة
- `desktop/package.json` — إعدادات البناء لكل المنصات + `productName: "Al-Arraab"`
- `desktop/build/icon.png` — أيقونة تاج ذهبية (512×512)
- `.github/workflows/build-desktop.yml` — بناء آلي عبر GitHub

## 🚀 كيف تولّد ملفات التثبيت (.exe / .dmg / .AppImage)

### الطريقة الأولى: GitHub Actions (موصى بها — تبني كل المنصات دفعة واحدة)

1. **اضغط زر "Save to Github"** من أعلى واجهة Emergent.
2. اذهب لمستودع GitHub الخاص بمشروعك → تبويب **Actions**.
3. اختر الـ workflow **build-desktop** → **Run workflow**.
4. انتظر ~7 دقائق حتى يكتمل البناء على Windows + macOS + Linux.
5. حمّل الملفات من تبويب **Artifacts**:
   - `misk-pos-windows-latest.zip` → داخلها `Al-Arraab Setup 1.0.0.exe` (installer) و `Al-Arraab 1.0.0.exe` (portable).
   - `misk-pos-macos-latest.zip` → داخلها `Al-Arraab-1.0.0.dmg`.
   - `misk-pos-ubuntu-latest.zip` → داخلها `Al-Arraab-1.0.0.AppImage` و `al-arraab-desktop_1.0.0_amd64.deb`.

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
1. يفتح تلقائياً `https://al3rab.shop` (أو صفحة `/activate`)
2. صاحب المحل يدخل كود التفعيل `MSK-XXXX-XXXX`
3. البرنامج يقفل نفسه على المحل — طباعة صامتة + auto-launch عند التشغيل
4. تحديث تلقائي عن بُعد لكل نسخ المحلات عند إصدار Tag جديد

## 🔧 تخصيص URL لكل محل (اختياري)

إذا أردت أن يتصل البرنامج بدومين مختلف (staging مثلاً):
```bash
AL_ARRAAB_URL=https://staging.al3rab.shop ./Al-Arraab
```
أو من الإعدادات داخل البرنامج (`electron-store` يحفظ التغيير للأبد).
