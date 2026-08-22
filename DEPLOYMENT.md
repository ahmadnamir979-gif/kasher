# 🚀 نشر العرّاب على al3rab.shop — دليل الإنتاج الكامل

## ⚠️ قبل كل شيء — تنبيه مهم حول Namecheap

**Namecheap Shared Hosting (Stellar / Stellar Plus / Stellar Business)** لا يشغّل النظام لأنه:
- ❌ لا يدعم Python 3 (FastAPI)
- ❌ لا يدعم MongoDB
- ❌ لا يدعم WebSockets
- ✅ يدعم فقط: PHP + MySQL + مواقع ثابتة

**الحل الوحيد**: نُبقي **الدومين** على Namecheap (رائع!) لكن **الاستضافة** يجب أن تكون على مزوّد يدعم Python + MongoDB.

---

## 🏗️ خيارات الاستضافة (مرتّبة من الأسهل للأصعب)

### 🥇 الخيار 1: Emergent Deploy (الأنصح)
- **التكلفة**: من داخل واجهة Emergent — اضغط زر **Deploy**
- **المميزات**: كل شيء آلي، MongoDB مُدار، SSL تلقائي، ربط دومين، ‏Backups
- **العيوب**: تكلفة شهرية (تظهر عند الضغط)

### 🥈 الخيار 2: DigitalOcean App Platform + MongoDB Atlas
- **التكلفة**: ~$12/شهر (App $5 + DB $7)
- **المميزات**: Managed, Auto-scaling, SSL تلقائي
- **العيوب**: تحتاج معرفة تقنية بسيطة

### 🥉 الخيار 3: VPS بسيط (الأرخص)
- **مزوّدين**: Hetzner CX11 (~€4.5/شهر) أو Contabo VPS ($4/شهر)
- **التكلفة**: ~$5/شهر
- **المميزات**: كل شيء تحت يدك
- **العيوب**: تحتاج تثبيت Docker + Nginx + MongoDB يدوياً (أدلّك)

### 🟦 الخيار 4: Railway.app (سريع للتجربة)
- **التكلفة**: ~$5/شهر (500 ساعة مجانية)
- **المميزات**: Deploy من GitHub بضغطة زر
- **العيوب**: قد يبطّئ عند الأحمال العالية

---

## 🌐 ربط دومين al3rab.shop بالاستضافة (بعد اختيار المزوّد)

### الخطوة 1: احصل على IP الاستضافة أو Nameservers
كل مزوّد يعطيك أحد الاثنين:
- **IP Address** (مثل: `123.45.67.89`) — للـ VPS
- **Nameservers** (مثل: `ns1.digitalocean.com`) — للـ Managed hosts

### الخطوة 2: افتح Namecheap
1. سجّل دخول على [namecheap.com](https://namecheap.com)
2. **Domain List** → بجانب `al3rab.shop` اضغط **Manage**
3. تبويب **Advanced DNS**

### الخطوة 3-أ: لو عندك IP (VPS)
احذف كل السجلات الموجودة وأضِف:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | `YOUR-VPS-IP` | Automatic |
| A Record | www | `YOUR-VPS-IP` | Automatic |
| CNAME | api | `al3rab.shop` | Automatic |

### الخطوة 3-ب: لو عندك Nameservers (Managed)
1. عد للتبويب **Domain**
2. **Nameservers** → اختر **Custom DNS**
3. الصق الـ 2-4 nameservers من المزوّد
4. Save

### الخطوة 4: انتظر 5-30 دقيقة للـ DNS propagation
تحقّق بموقع [whatsmydns.net](https://www.whatsmydns.net/) — أدخل `al3rab.shop` وشاهد الانتشار حول العالم.

### الخطوة 5: SSL Certificate (HTTPS)
- **Emergent / DigitalOcean / Railway**: SSL تلقائي عبر Let's Encrypt
- **VPS يدوي**: `sudo certbot --nginx -d al3rab.shop -d www.al3rab.shop`

---

## 🔧 إعدادات النظام قبل النشر

### backend/.env (على الإنتاج)
```env
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/alarraab
DB_NAME=alarraab_prod
CORS_ORIGINS=https://al3rab.shop,https://www.al3rab.shop
JWT_SECRET=<غيّرها لسر قوي 64 حرف>
STRIPE_SECRET_KEY=sk_live_...    # لو استخدمت Stripe للاشتراكات
EMERGENT_LLM_KEY=sk-emergent-... # يبقى نفسه
WEBHOOK_CRON_SECRET=<سر cron>
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=<كلمة سر قوية جديدة>
```

### frontend/.env (على الإنتاج)
```env
REACT_APP_BACKEND_URL=https://al3rab.shop
```

### desktop/main.js
تم تحديثه — `appUrl` الافتراضي الآن `https://al3rab.shop` ✅

---

## 📦 قائمة تحقّق قبل النشر
- [ ] اختر مزوّد استضافة (يفضّل Emergent Deploy)
- [ ] أنشئ حساب MongoDB Atlas (مجاني 512MB أو `$9/شهر لـ 2GB`)
- [ ] عدّل ملفات `.env` كما أعلاه
- [ ] غيّر كلمة سر الأدمن الافتراضية `Admin@1234` لكلمة سر قوية
- [ ] ولّد `JWT_SECRET` جديد قوي: `openssl rand -hex 32`
- [ ] ولّد `WEBHOOK_CRON_SECRET` جديد: `openssl rand -hex 32`
- [ ] ادفع الكود على GitHub (Save to GitHub)
- [ ] اربط GitHub بمزوّد الاستضافة → Auto-deploy عند كل push
- [ ] اضبط DNS Records على Namecheap
- [ ] فعّل SSL/HTTPS
- [ ] اختبر `https://al3rab.shop/login` — واجهة العرّاب الذهبية تظهر
- [ ] اختبر `POST /api/auth/login` من `https://al3rab.shop/api/auth/login`
- [ ] استرجع بيانات المحلات (لو نقلتها من preview) عبر `/api/backup/restore`
- [ ] ابنِ ملفات Desktop `.exe / .dmg` من GitHub Actions
- [ ] وزّع على أول 3 محلات كتجربة قبل التوسّع
