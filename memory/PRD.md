# PRD — نظام الكاشير + المحاسبة (SaaS متعدد المحلات)

## المشكلة الأصلية
مستخدم لديه برنامج كاشير مثبت على الجهاز (Misk POS) ويريد نسخة ويب مطابقة بميزات إضافية من "برنامج العربي للمحاسبة"، مع لوحة تحكم لتوزيع الكاشير على المحلات باشتراك سنوي، وقدرة على تفعيل/إيقاف كل محل ومشاهدة إحصائيات جميع المحلات. اللغة العربية RTL فقط والقطاع سوبرماركت.

## البنية (Architecture)
- **Backend**: FastAPI + MongoDB (Motor). Multi-tenant عبر `shop_id` في كل مستند. JWT (7 أيام) مع دعم Cookie و Bearer.
- **Frontend**: React 19 + React Router + Tailwind + Shadcn UI. RTL افتراضي. خط IBM Plex Sans Arabic + JetBrains Mono للأرقام.
- **Offline-first POS**: localStorage cache للمنتجات/الأصناف/المستودعات + طابور فواتير محلي + مزامنة تلقائية عند رجوع النت.
- **Auth**: BCrypt + JWT. Super admin يُبذر تلقائياً من `.env` (admin@pos.com / Admin@1234).
- **Subscription enforcement**: كل طلب من محل يتحقق من `is_active` و `subscription_expires_at`.

## الأدوار
- `super_admin`: مالك المنصة — يوزع المحلات، يجدّد/يوقف الاشتراك، يرى إحصائيات كل شيء.
- `shop_owner`: مالك المحل — كامل الصلاحيات داخل محله.
- `cashier` / `accountant` / `manager`: موظفون داخل محل.

## ما تمّ تنفيذه (Feb 25, 2026)

### Iteration 25 — Excel Live Link (Power Query) (Feb 25, 2026)
- **الربط المباشر مع Excel (`/excel-live`)**: 14 كيان (مبيعات، مشتريات، أصناف، عملاء، موردين، مصاريف، يومية، سندات، حسابات، شيكات، أصول ثابتة، ضبط مخازن، تقسيط، طلبيات) متاحة كـ CSV مباشر يتصل به Excel Power Query بدون أي تصدير يدوي.
- **رمز وصول للبيانات (Data Token) لكل محل**: تخزين في مجموعة `shops.live_data_token`. زر توليد/تدوير/إلغاء + تنبيه أمني.
- **نقاط API عامة**: `GET /api/live/{entity}.csv?token=xxx` و `.json` — لا تتطلب JWT، مصادقة بالرمز فقط، محصور بالمحل.
- **CSV مع UTF-8 BOM**: Excel يفتح الملفات العربية بشكل صحيح بدون خطوات إضافية.
- **حماية**: الاشتراك الموقوف يرفض الوصول. تدوير الرمز يبطل جميع الروابط القديمة فوراً.
- **دليل خطوة بخطوة** داخل الواجهة: Data → From Web → Paste URL → Auto-Refresh كل N دقيقة + دعم Google Sheets عبر `IMPORTDATA`.


- **الأصول الثابتة (`/fixed-assets`)**: قسط ثابت شهرياً بطريقة الخط المستقيم. لكل أصل: تصنيف (معدات/مركبات/مبانٍ/أثاث)، تكلفة شراء، عمر افتراضي، قيمة خردة. قيد شراء تلقائي في اليومية، وحساب فرعي مخصّص تحت 1201. ملخص لوحة يعرض التكلفة الإجمالية، مجمع الإهلاك، والقيمة الدفترية الصافية. ترحيل قيود إهلاك دفعة واحدة عبر زر واحد.
- **ترقيم الأصناف التلقائي (`/product-numbering`)**: قاعدة ترقيم لكل محل (بادئة + رقم بدء + عرض padding). عند إضافة صنف بدون باركود، يعطيه النظام الرقم التالي ثم ينتقل تلقائياً (مثال: SKU-00100 → SKU-00101).
- **معالجة أسعار الأصناف بالجملة (`/bulk-price`)**: رفع/تخفيض/إضافة/خصم/تعيين. النطاق: كل الأصناف أو فئة معينة. حقول: سعر بيع أو تكلفة. تقريب لأقرب 0.5/1/5. معاينة فورية للتأثير + تقرير تنفيذ.
- **مستندات ضبط المخازن (`/inventory-adjustments`)**: 6 أنواع (تلف/فقد/جرد/شطب لانتهاء الصلاحية/تعديل/جرد أول المدة). قيد يومية تلقائي في حالة التلف/الفقد/الشطب يخصم المخزون ويحمل حساب "خسائر مخزون" (5204). حذف المستند يعكس المخزون.
- **بدائل الأصناف (`/alternatives`)**: ربط ثنائي بين الأصناف — مفيد لقطع الغيار عند نفاد الأصل يعرض البديل. لوحتان جنباً إلى جنب: اختيار الصنف + عرض بدائله مع رصيدها وسعرها.


- **دفتر الأستاذ العام (`/ledger`)**: صفحة جديدة تعرض كل الحركات على حساب واحد مع رصيد متحرّك (running balance). فلاتر تاريخية، اختيار الحساب من dropdown، وطباعة نظيفة.
- **ربط ميزان المراجعة بدفتر الأستاذ**: كل صف في ميزان المراجعة قابل للنقر → ينتقل تلقائياً لدفتر أستاذ ذلك الحساب مع `account_id` في URL.
- **تصدير Excel لكل التقارير المحاسبية**: 4 نقاط API جديدة (`export.xlsx`):
  - `/accounting/vat-report/export.xlsx` — كشف الضريبة الشهري بتنسيق جاهز لسلطة الضرائب.
  - `/accounting/trial-balance/export.xlsx` — ميزان المراجعة الكامل.
  - `/accounting/profit-loss/export.xlsx` — قائمة الأرباح والخسائر مع تلوين الإيرادات (أخضر) والمصروفات (أحمر) وصافي الربح.
  - `/accounting/balance-sheet/export.xlsx` — الميزانية العمومية بأقسام (أصول / خصوم / حقوق ملكية).
  - كل الملفات RTL، بترميز عربي معياري، وبأعمدة معنونة تلقائياً بأسماء الحسابات وأرقامها.
- **زر تنزيل Excel** أضيف لكل من صفحة كشف الضريبة والتقارير المالية.


- **مِعمار مُوحّد**: أضيف `/app/backend/accounting_module.py` (وحدة قابلة للتوصيل) لتسجيل عشرات مسارات API الجديدة دون تضخيم `server.py`.
- **فهرس الحسابات (Chart of Accounts)**: 25 حساب افتراضي يُبذر تلقائياً لكل محل (أصول/خصوم/حقوق ملكية/إيرادات/مصروفات) بترميز أرقام حسابات هرمي عربي معياري. صفحة `/accounts` بواجهة كاملة (بحث/إضافة/حذف حسابات مخصّصة).
- **اليومية العامة (`/journal`)**: قيود مدين/دائن متوازنة، ترقيم تسلسلي تلقائي، حذف القيود اليدوية أو قيود السندات فقط، معاينة بيان القيد مع أسماء الحسابات.
- **قيود تلقائية للمبيعات والمشتريات**: كل فاتورة تُقيَّد تلقائياً في اليومية (نقد/عملاء ← إيرادات مبيعات + VAT + تكلفة البضاعة المباعة/المخزون). المشتريات كذلك (مخزون/VAT ← موردون/نقد).
- **السندات المالية (`/vouchers`)**: سندات قبض/صرف/قيد مع تبويبات، ربط تلقائي بـ (عميل/مورد/موظف) وتحديث رصيدهم، إنشاء قيد يومية تلقائي، ودعم الدفع بشيك.
- **البنوك والشيكات (`/banks`)**: إدارة حسابات بنكية (كل بنك يُنشئ حساب فرعي تحت 1102)، شيكات مستلمة/صادرة، حالات (معلّق/مودَع/مصروف/مقبوض/مرتجع)، وقيد عكسي تلقائي عند رجوع الشيك.
- **كشف ضريبة القيمة المضافة (`/vat`)**: تقرير VAT شهري (مخرجات vs مدخلات vs المستحق للسلطة).
- **التقارير المالية (`/financial-reports`)**: ميزان المراجعة + قائمة الأرباح والخسائر + الميزانية العمومية مع طباعة.
- **الفترات المالية المغلقة (`/closed-periods`)**: قفل الفترات لمنع أي تعديل على قيود سابقة (نهاية سنة/تدقيق) مع إمكانية إعادة الفتح.
- **مراكز التكلفة (`/cost-centers`)**: توزيع المصاريف على أقسام/مشاريع.
- **العملات المتعددة (`/currencies`)**: عملة أساسية (شيكل) + عملات إضافية بأسعار صرف.
- **الطلبيات (`/orders`)**: طلبيات مبيعات + طلبيات شراء مع دورة (مفتوح/مؤكد/مسلَّم/ملغى).
- **التقسيط (`/installments`)**: خطط تقسيط شهرية/أسبوعية مع جدول أقساط، تسديد جزئي/كامل، تحديث تلقائي لرصيد العميل.
- **فئات الأسعار (`/pricing-tiers`)**: جملة/تجزئة/VIP مع أسعار مخصّصة لكل صنف.
- **التصنيع (`/manufacturing`)**: وصفات المواد الخام + عمالة + تكاليف إضافية. إنتاج بدفعات يستهلك المواد ويضيف الناتج بمتوسط سعر تكلفة مُرجَّح.
- **تنبيهات الصلاحية (`/expiry`)**: تحذير للمنتجات المنتهية والمقاربة من الانتهاء (نافذة أيام قابلة للتخصيص). حقل `expiry_date` أضيف لنموذج `ProductIn`.
- **إعادة تنظيم الشريط الجانبي**: مقسّم لثلاث أقسام (التشغيل/المحاسبة/أخرى) مع أيقونات محدّثة.



### Iteration 21 — Rebrand to "العرّاب" (Al-Arraab) + Premium Login (Aug 22, 2026)
- **Full rebrand**: App name changed everywhere from "Misk POS" to **"العرّاب"** (Al-Arraab). Files touched: `Login.jsx`, `Activate.jsx`, `Settings.jsx`, `public/index.html` title, `desktop/package.json` (`appId: com.alarraab.pos`, `productName: Al-Arraab`, `shortcutName`), `desktop/main.js` (window title, store name, env var).
- **New premium Login page**: Dark `#0a0a0f` background with amber/gold ambient blur, gold gradient crown crest, gradient gold "العرّاب" wordmark + English "AL-ARRAAB" subtitle, glass-morphism form (backdrop-blur white/5 with border white/10), gold gradient button, and a "لديك كود تفعيل؟" quick-link card.
- **Removed public/demo content**: The old "نظام إدارة المحلات" header, the "كاشير + محاسبة + اشتراكات" subtitle, the feature-grid section, and the "حساب المشرف الرئيسي: admin@pos.com / Admin@1234" hint are all gone from the public login page.
- **Activate page** also received the matching premium dark-gold Al-Arraab treatment.
- **Desktop icon** regenerated as a gold rounded-square with a black crown and jeweled base at `desktop/build/icon.png` (512×512).

### Iteration 20 — Shop Activation Codes (like distributed .exe licenses) (Aug 22, 2026)
- **Central architecture** clarified & documented: single cloud MongoDB (our stack, not Firebase) with `shop_id` isolating every shop's data; Super Admin creates shops which now receive an auto-generated activation code.
- **Code format**: `MSK-XXXX-XXXX` (Crockford's base32 alphabet — no confusing O/0/I/1/L), collision-checked before insert.
- **Backend additions**:
  - `POST /api/admin/shops` now returns `{ shop_id, activation_code }` alongside the existing user creation.
  - `POST /api/admin/shops/{shop_id}/regenerate-code` — instantly rotates the code (old one stops working).
  - `POST /api/activate` — public endpoint (no auth) that trades a code for a JWT + user context. Rejects if code invalid, shop deactivated, or subscription expired.
  - Backfilled every existing shop with its own activation code (script run once).
- **Super Admin UI**: New "كود التفعيل" column shows the code in a monospace emerald pill, with a **Copy** button and a **Regenerate** button (with confirm dialog).
- **New public page `/activate`**: Dark-themed splash with a big 3-block auto-formatted input (`MSK-XXXX-XXXX`), auto-uppercases, strips invalid chars, and shows shield/lock icons. On success stores token, sets `cached_user`, and navigates to `/pos`. Verified: activation succeeds → wrong code returns 404 → regenerating code invalidates the old one.
- Ready to be wired into the Electron desktop app: `desktop/main.js` can open `/activate` as the initial URL so each `.exe` copy asks for its code once and locks itself to the shop.

### Iteration 19 — Per-Shop Backup & Restore (Aug 22, 2026)
- Added 3 backend endpoints in `server.py`: `GET /api/backup/summary` (per-shop counts), `GET /api/backup/export` (streams a ZIP with 14 collection JSON files + `manifest.json` + `shop.json` + `totals.json` scoped to `shop_id`), `POST /api/backup/restore?mode=merge|replace` (accepts ZIP upload; `merge` upserts by `id`, `replace` wipes shop data then inserts).
- Security: on restore, `shop_id` is **forced** to the current user's shop for every doc — cross-tenant contamination is impossible even if a malicious backup file is uploaded.
- UTF-8 Arabic filenames encoded via RFC 5987 `Content-Disposition: attachment; filename*=UTF-8''...`; ASCII fallback for older browsers.
- Frontend Settings page now has a "النسخ الاحتياطي" section: live totals dashboard (products/sales/customers/…), one-tap download button, file-picker + mode selector (Merge/Replace with confirm dialog for destructive), and a post-restore result panel showing per-collection counts + source shop name/date.
- Verified end-to-end: exported 15KB ZIP with 17 files → re-uploaded via restore → 134 documents restored across 14 collections with zero errors.

### Iteration 18 — Real Electron Desktop App (Aug 22, 2026)
- Built a fully working Electron 32 wrapper in `/app/desktop`: `main.js` opens the app, handles IPC for silent print (`webContents.print({ silent:true, deviceName })`), auto-launch, and `electron-updater` auto-updates from GitHub Releases.
- `preload.js` exposes a safe `window.desktopAPI` (`isDesktop`, `listPrinters`, `getSettings`, `setSettings`, `silentPrint`).
- Frontend `Settings` page now detects Electron and shows real OS printers with radio-card picker + refresh + "auto-launch" toggle; in web mode it shows the plain input + a download-installer banner.
- POS silent-prints via `desktopAPI.silentPrint` when running inside Electron; falls back to hidden-iframe `window.print()` on web.
- Added `.github/workflows/build-desktop.yml` matrix build for Windows (.exe installer + portable), macOS (.dmg), Linux (.AppImage + .deb) with GitHub Releases publishing on tag push.
- Full step-by-step user guide in `desktop/BUILD_INSTRUCTIONS.md` and `desktop/README.md`.

### Iteration 17 — Settings Page + Printer Config (Aug 22, 2026)
- New `/settings` page with a dedicated "إعدادات الطابعة" section: auto-print toggle, default printer name field, paper size (58mm / 80mm / A4), copies-per-invoice (1-5) with +/− stepper, and a "طباعة إيصال تجريبي الآن" test button that renders a live sample slip.
- Preferences saved in `localStorage` (`pos_auto_print`, `pos_printer_name`, `pos_paper_size`, `pos_print_copies`); POS reads them on every sale and loops copies with staggered timing.
- Removed the top-bar auto-print toggle from POS — the whole config now lives on Settings.
- Added a "برنامج مثبّت لكل محل" section explaining the Electron/Tauri desktop-app path with a WhatsApp order button, so the shop can request an installable binary when ready.

### Iteration 16 — Auto-Print to Connected Printer (Aug 22, 2026)
- POS top bar now shows an "طباعة تلقائية" toggle (green when on) + a help (؟) icon that opens Arabic instructions for Chrome silent printing (`--kiosk-printing`).
- Preference persisted in `localStorage.pos_auto_print`; when enabled, every successful sale calls `printReceipt("receipt-print-area")` automatically 250ms after the receipt dialog appears.
- Free 100% — works with any OS-registered printer (80mm thermal or A4). No SDK, no cloud service, no per-print fees.

### Iteration 15 — Remove duplicate WA button (Aug 22, 2026)
- Removed the emerald "واتساب للزبون" button from the POS bottom action bar; WhatsApp send is now available only from the "تمّ حفظ الفاتورة" dialog to avoid confusion. Bottom grid rebalanced to 8 columns.

### Iteration 14 — Keep WA dialog open after send (Aug 22, 2026)
- Removed the auto-close on "فتح واتساب" so cashier can fix a wrong number and reopen WhatsApp without retyping. Dialog only closes via إلغاء / X. Toast confirms the open action.

### Iteration 13 — WhatsApp Touch Numpad + Backspace (Aug 22, 2026)
- WhatsApp dialog now sports a big amber "تراجع" button that deletes the last digit of the phone in one tap, a 3×4 touch numpad (1-9, 0) for eyes-free entry on POS touch screens, and a rose "مسح" button for a full clear.
- Input is digit-only (auto-strips non-numeric paste), rendered LTR at `text-lg` for legibility on the cashier stand.

### Iteration 12 — English digits site-wide (Aug 22, 2026)
- Switched `fmt`/`fmtInt` in `/lib/api.js` from `ar-EG` locale to `en-US` so every price/qty/balance/invoice number renders with Latin digits (e.g. `755.00` instead of `٧٥٥٫٠٠`).
- Aligned every date/time formatter in POS, Receipt, and Transfers to `en-GB` so dates read `22/08/2026 00:29`.

### Iteration 11 — الديون والذمم + ترحيل الفاتورة على دين (Aug 22, 2026)
- **إعادة تسمية الصفحة**: "تذكيرات الديون" → **"الديون والذمم"** في القائمة الجانبية وترويسة الصفحة.
- **بطاقات إحصائية**: إجمالي الديون + عدد المدينين + عدد التذكيرات المستحقة اليوم في أعلى الصفحة.
- **إدارة كاملة للمدينين**: زر أخضر "إضافة عميل مدين" (اسم + هاتف + رصيد ابتدائي) + أيقونة قلم للتعديل + أيقونة سلة للحذف — عند الحذف يُحذف العميل وكل تذكيراته المرتبطة به.
- **زر "ترحيل دين" في POS**: بدلاً من "وصل هدية". يفتح حوار عصري يعرض:
  - إجمالي الفاتورة عالياً
  - قائمة كل العملاء مع رصيدهم الحالي مرتّبة حسب الأعلى مديونيةً
  - بحث فوري بالاسم أو الهاتف
  - قسم إضافة عميل جديد داخل الحوار بضغطة واحدة "إضافة ومحاسبة على الدين"
- **البيع الآجل**: عند اختيار العميل تُنشأ فاتورة بـ `payment_method="credit"` و `paid=0`، فيزيد رصيد العميل تلقائياً بمبلغ الإجمالي (تحقّقنا: 450 → 482 بعد فاتورة 32). الإيصال يعرض اسم العميل وطريقة الدفع "آجل".

### Iteration 10 — Debt Reminders + WhatsApp One-Click (Aug 22, 2026)
- **صفحة `/reminders`**: قائمة العملاء المدينين (balance > 0) مع زر "جدولة تذكير" لكل عميل. حوار يعرض المبلغ + منتقي التاريخ + قالب رسالة عربية قابل للتعديل يحوي اسم الزبون واسم المحل والمبلغ.
- **بحث فوري**: صندوق بحث في أعلى الصفحة يفلتر بطاقات العملاء المدينين وجدول التذكيرات معاً بالاسم أو رقم الهاتف — عند سداد العميل يمكن البحث عن اسمه وحذف تذكيره بسرعة.
- **تعديل اسم/رقم العميل**: أيقونة قلم على كل بطاقة عميل تفتح حوار تعديل الاسم والرقم. عند التحديث تُزامَن كل التذكيرات المرتبطة بذلك العميل تلقائياً في `debt_reminders` (customer_name + customer_phone).
- **تذكيرات متكررة**: خيار جديد في حوار الجدولة (مرة واحدة / كل أسبوع / كل شهر). عند تعليم تذكير متكرر كـ"أُرسل" ينشئ الـ backend نسخة تالية تلقائياً على التاريخ الجديد (+7 أو +30 يوم) بحالة `pending` — يستمر التكرار للأبد حتى يحذفه المستخدم يدوياً. شارة بنفسجية 🔁 "أسبوعي/شهري" تظهر بجانب كل تذكير متكرر.
- **جرس تنبيهات**: مكوّن `ReminderBell` في الشريط العلوي `AppShell` يستدعي `/api/debt-reminders/due-count` كل دقيقة ويعرض عدّاد أحمر مع نبض أمبر عندما تكون هناك تذكيرات مستحقة اليوم.
- **إرسال بضغطة واحدة**: زر "واتساب" يفتح `wa.me/<phone>?text=<url-encoded>` بالرسالة الجاهزة، ثم يستدعي `PATCH /debt-reminders/{id}/mark-sent` تلقائياً لتحديث الحالة إلى "أُرسلت".
- **Cron يومي**: `.emergent/crons.yml` يشغّل `POST /api/cron/debt-reminders` كل يوم 6 صباحاً بتوقيت القدس. الـ endpoint محمي بـ `WEBHOOK_CRON_SECRET` (401 بدون auth) ويرفع كل التذكيرات من `pending` إلى `due` عند حلول موعدها.
- **Backend Endpoints جديدة**: `PATCH /api/customers/{cid}` لتعديل اسم/رقم العميل مع مزامنة `debt_reminders`. حقل `repeat` مضاف لـ `debt_reminders` collection.

### Iteration 9 — Offline-First POS + Network Resilience (Aug 21, 2026)
- **وضع الأوفلاين للـ POS**: عند انقطاع الإنترنت يُحمَّل POS من الذاكرة المحلية (منتجات/أصناف/مستودعات/فواتير معلّقة/وردية حالية) — كل شيء يتحدّث في `localStorage` بمفاتيح مسمّاة حسب `shop_id`.
- **طابور فواتير أوفلاين**: عند فشل POST `/sales` بسبب الشبكة، تُحفظ الفاتورة محلياً في طابور `pos_sale_queue_<shopId>` مع باركود مؤقّت `OFF-xxx` وإيصال حراري قابل للطباعة/الواتساب فوراً.
- **مزامنة تلقائية عند رجوع النت**: مستمع `window.online` + محاولة مزامنة أولى عند فتح الصفحة. الفواتير تُرفع بالترتيب وتُحذف من الطابور واحدة واحدة، مع رسالة "تمّت مزامنة N فاتورة" وتحديث المخزون.
- **مؤشر حالة الاتصال**: شارة في الشريط العلوي (أخضر "متصل" • أحمر "بدون إنترنت + عدّاد الطابور" • أصفر "مزامنة (N)") قابلة للنقر لتشغيل المزامنة اليدوية.
- **إصلاح "Network Error" عند الدخول**: `AuthContext` يخزّن المستخدم في `cached_user` وعند فشل `/auth/me` بخطأ شبكي فقط تُستعاد الجلسة تلقائياً بدل إخراج الكاشير — مع تعليم الحالة كأوفلاين.
- **بطاقات المنتجات**: أُزيل الحرف الأول المختصر، الاسم الكامل ظاهر في المنتصف مع شريط لون الفئة الرفيع أعلى البطاقة.

### Iteration 7 — Templates + Preview + Rollback + Historical Invoices (Aug 19, 2026)
- **قوالب النقل**: كل عملية ربط يمكن حفظها كقالب مربوط بـ (المحل + نوع البيانات + بصمة الأعمدة SHA1). في المرة القادمة يُطبَّق القالب تلقائياً دون استدعاء الذكاء الاصطناعي مع شارة بنفسجية "قالب محفوظ".
- **معاينة حية**: أسفل جدول الربط يظهر جدول أزرق يعرض أول 3 صفوف كما ستُستورد فعلاً (مع تعبئة القيم الافتراضية) وأيقونة ✅/⚠️ توضح صحة كل سطر — يتحدث فوراً عند أي تعديل على الربط.
- **تراجع عن الاستيراد**: كل دفعة تحصل على `batch_id` وتُخزَّن قائمة السجلات المُنشأة. في صفحة النقل الرئيسية قسم "آخر عمليات النقل" مع زر "تراجع" لكل دفعة يحذف السجلات بضغطة واحدة. حماية من التراجع مرتين.
- **استيراد فواتير تاريخية**: كيان جديد "الفواتير التاريخية" (بنفسجي) يستورد فواتير سنوات ماضية إلى مجموعة `sales` مع علم `is_historical=true` و `items=[]` — لا تؤثر على المخزون ولا الأرباح، بل تحفظ السجل التاريخي للزبائن فقط.

### Iteration 6 — AI Migration Wizard (Aug 19, 2026)
- **نقل ذكي من الأنظمة القديمة**: صفحة `/migration` بأربع خطوات (اختر النوع → ارفع الملف → راجع الربط الذكي → استيراد). تقبل Excel/CSV بأي أسماء أعمدة عربية أو إنجليزية.
- **ذكاء اصطناعي لربط الأعمدة**: عند التحليل نستدعي `LlmChat` (gpt-4o-mini عبر Emergent LLM Key) الذي يقرأ عناوين الأعمدة + عيّنات صفوف ويقترح ربطاً تلقائياً لكل عمود مع مفتاح schema المناسب. عند فشل LLM يوجد fallback حروف مطابقة (aliases عربية/إنجليزية) — لا يفشل التحليل أبداً.
- **دعم 3 كيانات**: المنتجات (مع فئات جديدة تلقائياً + باركود تلقائي لأي منتج بدونه) + العملاء + الموردين (مع رصيد افتتاحي).
- **معاينة قبل التنفيذ**: جدول ربط قابل للتعديل، تحذير أحمر عند عدم ربط الحقول الإجبارية، منع الاستيراد حتى الربط الصحيح.

### Iteration 5 — Held Reprint + Barcode Scan Add (Aug 19, 2026)
- **طباعة الفواتير المعلّقة**: زر "طباعة" بجانب "استئناف" لكل فاتورة معلّقة يُنتج إيصال حراري 80mm عليه شارة سوداء "★ طلب معلّق — بانتظار العودة ★" مع اسم المحل والأصناف والمبلغ المتوقع، ينفع كتذكرة يحتفظ بها الزبون قبل عودته.
- **إضافة منتج بمسح الباركود (Barcode Scan Add)**: إذا مسح الكاشير باركود غير موجود في النظام (رقم 6 خانات فأكثر + Enter)، تُفتح تلقائياً نافذة "منتج جديد" مع الباركود مُعبّأً مسبقاً، يُدخل الاسم والسعر (وتكلفة/كمية اختيارياً) ويحفظ فيدخل المنتج المخزن ويُضاف للسلة فوراً — بدون مغادرة شاشة POS.

### Iteration 4 — Held / Transfer / Auto-Barcode (Aug 19, 2026)
- **الفواتير المعلّقة (Held Invoices)**: زر "تعليق الفاتورة" في POS يحفظ السلة الحالية على السيرفر (مربوطة بالمحل) ويُفرغ الصندوق لخدمة زبون آخر. شارة عليها عدّاد في الشريط العلوي تفتح قائمة الفواتير المعلّقة مع زر "استئناف" لكل منها. مشاركة بين الكاشيرين في نفس المحل مع اسم من علّقها.
- **تحويلات المخزون (Stock Transfer)**: صفحة `/transfers` بحوار "إذن تحويل جديد" (اختيار من/إلى + سطور أصناف مع كمية) + جدول تاريخ التحويلات. يُنفَّذ التحويل بتناقص الكمية من مخزن المصدر وإنشاء/زيادة "توأم" في مخزن الوجهة (نفس الاسم). زر "طباعة" ينتج إذن رسمي A4 مع اسم المحل، رقم الإذن، تواقيع المخزنين. حماية من (from==to)، من نقص الرصيد، ومن اختيار منتج ليس في مخزن المصدر.
- **باركود تلقائي (Auto Barcode)**: عند إنشاء منتج بدون باركود يقوم الخادم بإنشاء رقم 13 خانة يبدأ بـ "2" (نمط EAN-13 داخلي) — سواء عبر واجهة الإضافة أو استيراد Excel، مع فحص عدم التكرار في نفس المحل.

### Iteration 3 — POS Redesign + Advanced Features (Aug 19, 2026)
- **إعادة تصميم POS بشكل يشبه مرجع Misk POS**: شريط علوي بأزرار ملوّنة (الرئيسية/الأرشيف/البطاقات/تحديث/الوقت)، تخطيط ثلاثي (يمين: فئات + شبكة منتجات 3 أعمدة، وسط: جدول فاتورة بشريط رأس داكن + سطر إجمالي/خصم/ملاحظات، يسار: طرق الدفع + تفاصيل الصنف)، صف سفلي بـ 8 أزرار ملوّنة (حفظ الفاتورة/طباعة/وصل هدية/تفاصيل الدفع/عرض سعر/مردودات/واتساب)، شريط حالة سفلي بمعلومات الموظف/الصندوق/المخزن.
- **مرتجعات المبيعات (Sales Returns)**: زر "فاتورة مردودات" في POS يفتح قائمة الفواتير السابقة، أو زر "إرجاع" مباشر في صفحة المبيعات. عند التأكيد يُنشأ مرتجع كامل + استرجاع المخزون تلقائياً + إبطال إعادة نفس الفاتورة مرتين.
- **ملصقات الباركود**: صفحة كاملة (`/barcodes`) تعرض المنتجات مع Checkboxes + عدد نسخ، معاينة على شكل شبكة A4 (4 أعمدة) باستخدام JsBarcode SVG، زر "توليد باركود للمفقود" ينشئ باركود عشوائي لأي منتج بدون باركود، وزر طباعة يفتح صفحة بنافذة منفصلة.
- **تعدد المخازن (Multi-Warehouse)**: صفحة `/warehouses` لإدارة المخازن مع مخزن افتراضي تلقائي لكل محل. اختيار مخزن في POS + المشتريات + إضافة المنتج. حماية من حذف المخزن الأخير أو الافتراضي.
- **إرسال الفاتورة عبر واتساب**: زر "واتساب للزبون" بعد أي بيع يفتح حوار لإدخال رقم الزبون، ثم يبني رابط `wa.me` مع نص جاهز يحتوي اسم المحل + رقم الفاتورة + الأصناف + الإجمالي + رسالة شكر. لا يتطلب أي API.

### Iteration 2 — Additions (Aug 19, 2026)
- **استيراد Excel للمنتجات**: تحميل قالب `.xlsx` + رفع ملف مع إنشاء تلقائي للفئات الجديدة (`/api/products/template`, `/api/products/import`).
- **طباعة الفاتورة الحرارية 80mm**: بعد نجاح البيع تُفتح معاينة قابلة للطباعة تحتوي اسم المحل + رقم الفاتورة + الأصناف + الإجمالي + طريقة الدفع.
- **الورديات (Shifts) + فرق الصندوق**: فتح وردية بمبلغ افتتاحي، إغلاقها بحساب تلقائي للنقد المتوقع = افتتاح + مبيعات نقدية - مرتجعات، ثم عرض الفرق (variance). صفحة سجل ورديات كاملة.
- **تجديد اشتراك أونلاين (Stripe)**: `Flow B` باستخدام `emergentintegrations` + `STRIPE_API_KEY=sk_test_emergent`. زر تجديد في لوحة المحل يظهر تلقائياً عند اقتراب الانتهاء (≤ 30 يوم). Webhook + polling يوسّع `subscription_expires_at` بعد الدفع.

### Iteration 1 (Aug 19, 2026)

### Super Admin
- تسجيل دخول + لوحة تحكم بإحصائيات (إجمالي المحلات، النشطة، المنتهية، إجمالي المبيعات).
- إدارة المحلات (إضافة، تعديل، حذف، تفعيل/إيقاف).
- تمديد الاشتراك بشهور (Timedelta 30*months).
- صفحة اشتراكات مع أيام متبقية وترتيب حسب الأقرب انتهاءً.

### Shop Workspace
- **نقطة البيع (POS)**: شبكة منتجات بألوان الفئات، سلة على اليسار، بحث بالباركود/الاسم، اختصارات F1 (نقدي) F2 (بطاقة) Ctrl+F (بحث)، حساب ضريبة + خصم فوري.
- **لوحة تحكم المحل**: مبيعات اليوم/الأسبوع/الشهر، ربح، تنبيهات مخزون، أفضل ٥ منتجات، رسم بياني لآخر ٧ أيام.
- **المنتجات والمخزون**: إضافة/حذف منتج، فئات ملونة، سعر تكلفة/بيع، حد أدنى، نسبة ضريبة، تحذير مخزون منخفض.
- **المبيعات**: جدول كامل بالفواتير + الربح + طريقة الدفع + الكاشير + حالة المرتجع.
- **المشتريات**: نموذج فاتورة شراء يحدّث المخزون والتكلفة تلقائياً.
- **العملاء + الموردين**: CRUD كامل + رصيد افتتاحي + بيانات اتصال.
- **الموظفين**: إنشاء حسابات كاشير/محاسب/مدير برصيدهم الخاص.
- **المصاريف**: تسجيل يومي + إجمالي مباشر.
- **التقارير**: قائمة أرباح وخسائر لفترات (٧ / ٣٠ / ٩٠ / ٣٦٥ يوم).

## Backlog (Priority)

### P1 (Next)
- طباعة فاتورة حرارية (Receipt Printing) مع QR/Barcode.
- ورديات كاشير (Shifts) مع إغلاق وحساب الفروقات نقدي.
- استيراد المنتجات من Excel + تصدير التقارير PDF/Excel.
- المرتجعات من واجهة POS مباشرة (اختيار فاتورة سابقة).

### P2
- ربط WhatsApp/SMS لإرسال الفواتير للزبائن.
- دفع Stripe لتجديد الاشتراك أونلاين (بدل التفعيل اليدوي).
- تعدد المخازن + نقل بين المخازن.
- Barcode label printing.
- دليل حسابات كامل + قيود يدوية (Chart of Accounts + Journal Entries).
- تواريخ صلاحية للمنتجات + تنبيهات.
- Serial numbers / Batches.

### P3
- تطبيق موبايل (React Native) للمندوبين.
- ذكاء اصطناعي للتقارير (اسأل بيانتك).
- API عام (REST) للتكامل مع أنظمة خارجية.

## Test Credentials
- Super admin: `admin@pos.com` / `Admin@1234`
- بيانات محلات الاختبار تُنشأ من واجهة السوبر أدمن.
