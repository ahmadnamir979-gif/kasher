# Misk POS — Desktop App

نسخة سطح المكتب (Windows / macOS / Linux) من نظام Misk POS، مبنية بـ **Electron 32**.

## المميزات (لا تحتاج Chrome)
- ✅ **طباعة صامتة** إلى طابعة الإيصالات الافتراضية بدون نافذة اختيار (`webContents.print({ silent: true, deviceName })`).
- ✅ **حفظ إعدادات الطابعة والمقاس وعدد النسخ** لكل جهاز في `electron-store`.
- ✅ **يعمل أوفلاين كاملاً** — نفس منطق الأوفلاين المطبّق في التطبيق الويب.
- ✅ **Auto-launch عند تشغيل الحاسوب** (`app.setLoginItemSettings`).
- ✅ **تحديث تلقائي** من GitHub Releases عبر `electron-updater`.

## البناء المحلي (للمطور)

```bash
cd desktop
npm install
npm start                 # يفتح النظام في نافذة Electron
npm run dist:win          # يبني ملف .exe (على Windows)
npm run dist:mac          # يبني ملف .dmg (على macOS)
npm run dist:linux        # يبني AppImage + .deb (على Linux)
```

## البناء الآلي عبر GitHub Actions

الملف `.github/workflows/build-desktop.yml` يبني تلقائياً لثلاث منصات دفعة واحدة:

1. اضغط **"Save to GitHub"** من داخل Emergent لدفع المشروع إلى GitHub.
2. من صفحة المشروع في GitHub → تبويب **Actions** → **build-desktop** → **Run workflow**.
3. عند الانتهاء (~7 دقائق) اذهب لتبويب Artifacts وحمّل:
   - `misk-pos-windows-latest.zip` → يحوي `Misk POS Setup 1.0.0.exe` و `Misk POS 1.0.0.exe` (portable).
   - `misk-pos-macos-latest.zip` → يحوي `.dmg`.
   - `misk-pos-ubuntu-latest.zip` → يحوي `.AppImage` و `.deb`.

## التحديثات التلقائية لكل المحلات

عند إصدار Tag جديد (`git tag v1.0.1 && git push --tags`) الـ workflow ينشر GitHub Release تلقائياً وكل نسخ المحلات تُحدَّث في الخلفية.

## إعدادات التخصيص

- `desktop/main.js` — يحوي URL التطبيق (المحفوظ في electron-store). كل محل يستطيع تغييره من الإعدادات.
- `desktop/build/icon.png` — أيقونة البرنامج (استبدلها بشعارك 512×512).
