<div align="center">

<img src="public/logo.png" alt="P00RIJA" width="140" style="border-radius:24px" />

# P00RIJA Portfolio

**Interactive 3D Portfolio + Full CMS + AI Companion**

[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE-COMMERCIAL.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://docker.com)

[English](#english) · [فارسی](#فارسی)

</div>

---

## Preview

| Hero — 3D Planetary Navigation | Graphics Section |
|:---:|:---:|
| ![Hero](screenshots/hero.png) | ![Graphics](screenshots/graphics.png) |

| AI Section | Timeline & Résumé |
|:---:|:---:|
| ![AI](screenshots/ai-section.png) | ![Timeline](screenshots/timeline.png) |

| Galaxy Arcade (26 Games) | Pixel Buddy AI |
|:---:|:---:|
| ![Arcade](screenshots/arcade.png) | ![Pixel Buddy](screenshots/pixel-buddy.png) |

| Security Section | Synthesis |
|:---:|:---:|
| ![Security](screenshots/security.png) | ![Synthesis](screenshots/synthesis.png) |

---

<a name="english"></a>

## 🇬🇧 English

### What is this?

A **production-grade portfolio website** with a built-in CMS, AI chatbot, 26 arcade games, and a commercial licensing system. Designed for creators who want a stunning, interactive 3D portfolio that they can manage without touching code.

### ✨ Key Features

| | |
|---|---|
| 🪐 **3D Planetary Navigation** | Visitors travel between three worlds — Graphics, Security, AI — via an interactive solar system |
| 🧩 **Full CMS** | Edit every section, upload media, manage SEO, create forms, adjust 3D objects — all from a beautiful admin panel |
| 🤖 **Pixel Buddy AI** | A cute pixel-art pet that wanders the site, entertains visitors, and answers questions about you using any AI provider (Gemini, OpenAI, Groq, Claude, and more) |
| 🎮 **Galaxy Arcade** | 26 built-in retro games with touch, keyboard, and mouse support — platformers, puzzles, shooters, brain teasers |
| 📊 **Analytics** | First-party visitor tracking with world map, Geo-IP, session duration — zero third-party scripts |
| 🛡 **Defense System** | Bot detection, rate limiting, IP banning, live threat feed |
| 🔐 **Commercial Licensing** | 5-day free trial → signed license activation → remote revocation |
| 📱 **PWA** | Installable on phones and desktops with custom icons |
| 🍪 **GDPR Compliant** | No tracking before explicit consent; Do Not Track respected |
| 🌐 **Bilingual** | Full English + Persian (RTL) with live language switching |

### 🚀 Quick Start

#### One-Command Install

```bash
curl -fsSL https://raw.githubusercontent.com/Poorija/P00RIJA-PORTFOLIO/main/scripts/install-from-github.sh | sudo -E bash
```

#### Docker

```bash
docker pull p00rija/portfolio:latest
docker compose -f docker-compose.hub.yml up -d
# → http://localhost:3000
```

#### From Source

```bash
git clone https://github.com/Poorija/P00RIJA-PORTFOLIO.git
cd P00RIJA-PORTFOLIO
cp .env.example .env
npm ci && npx prisma generate && npx prisma db push
npm run build && npm start
```

### ⏱ 5-Day Trial

| Day | What happens |
|-----|-------------|
| 1–4 | Full access with trial countdown |
| 5 | Last day — "Buy License" appears |
| 6+ | App locks — only `/license` page available |

The trial is **tamper-resistant** — the start timestamp is stored in two independent locations with HMAC checksums.

### 💰 Purchase a License

Click **"Buy License"** in the app — a pre-filled email template opens:

> 📧 **p00rija@tutamail.com**
> 💎 **TON:** `UQCEgGxRZ5A101w6RBNLwHhnva5EdK3kyDsFQcxni35DlCJf`

| Plan | Duration |
|------|----------|
| Monthly | 30 days |
| Quarterly | 90 days |
| Semi-Annual | 180 days |
| Annual | 365 days |
| Perpetual | Forever |
| Custom | Multi-server, custom terms |

### 🔧 Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `ADMIN_PASSWORD` | `admin123` | CMS login — **change immediately** |
| `AUTH_SECRET` | auto | Session encryption key |
| `DATABASE_URL` | `file:/app/db/custom.db` | SQLite path |
| `AI_API_KEY` | — | AI provider key (for Pixel Buddy) |
| `GROQ_API_KEY` | — | Groq fallback key |

### 📞 Contact

> 📧 **p00rija@tutamail.com**
> 💎 **TON:** `UQCEgGxRZ5A101w6RBNLwHhnva5EdK3kyDsFQcxni35DlCJf`

---

<a name="فارسی"></a>

## 🇮🇷 فارسی

### این چیست؟

یک **وب‌سایت تعاملی سطح پروداکشن** با سیستم مدیریت محتوای داخلی، چت‌بات هوش مصنوعی، ۲۶ بازی آرکید و سیستم لایسنس تجاری. طراحی شده برای خالقانی که یک پورتفولیوی سه‌بعدی تعاملی خیره‌کننده می‌خواهند، بدون نیاز به برنامه‌نویسی.

### ✨ ویژگی‌های اصلی

| | |
|---|---|
| 🪐 **۳D سیاره‌ای ناوبری** | بازدیدکنندگان بین سه جهان — گرافیک، امنیت، هوش مصنوعی — در یک منظومه‌ی شمسی تعاملی سفر می‌کنند |
| 🧩 **CMS کامل** | ویرایش همه‌ی بخش‌ها، آپلود رسانه، مدیریت سئو، ساخت فرم، تنظیم اشیاء سه‌بعدی — همه از یک پنل مدیریت زیبا |
| 🤖 **همدم پیکسلی AI** | یک پت پیکسل‌آرت بامزه که در سایت پرسه می‌زند، بازدیدکنندگان را سرگرم می‌کند و با هر سرویس هوش مصنوعی (Gemini، OpenAI، Groq، Claude و...) به سوالات درباره‌ی شما پاسخ می‌دهد |
| 🎮 **مرکز بازی** | ۲۶ بازی داخلی با پشتیبانی لمس، کیبورد و موس — پلتفرمر، پازل، شوتر، فکری |
| 📊 **آمار** | ردیابی first-party با نقشه جهان، Geo-IP، مدت نشست — بدون هیچ اسکریپت شخص ثالث |
| 🛡 **سیستم دفاعی** | تشخیص ربات، rate limiting، بن IP، فید زنده تهدید |
| 🔐 **لایسنس تجاری** | ۵ روز آزمایشی رایگان → فعال‌سازی فایل لایسنس امضاشده → ابطال از راه دور |
| 📱 **PWA** | قابل نصب روی گوشی و دسکتاپ با آیکون سفارشی |
| 🍪 **مطابق GDPR** | بدون ردیابی قبل از رضایت صریح؛ احترام به Do Not Track |
| 🌐 **دوزبانه** | کامل فارسی + انگلیسی (RTL) با تعویض زبان زنده |

### 🚀 نصب سریع

#### نصب یک‌خطی

```bash
curl -fsSL https://raw.githubusercontent.com/Poorija/P00RIJA-PORTFOLIO/main/scripts/install-from-github.sh | sudo -E bash
```

#### داکر

```bash
docker pull p00rija/portfolio:latest
docker compose -f docker-compose.hub.yml up -d
# → http://localhost:3000
```

#### از سورس

```bash
git clone https://github.com/Poorija/P00RIJA-PORTFOLIO.git
cd P00RIJA-PORTFOLIO
cp .env.example .env
npm ci && npx prisma generate && npx prisma db push
npm run build && npm start
```

### ⏱ دوره‌ی آزمایشی ۵ روزه

| روز | چه اتفاقی می‌افتد |
|-----|-------------------|
| ۱–۴ | دسترسی کامل با شمارش معکوس |
| ۵ | آخرین روز — دکمه «خرید لایسنس» ظاهر می‌شود |
| ۶+ | برنامه قفل می‌شود — فقط صفحه `/license` در دسترس |

دوره‌ی آزمایشی **ضد دستکاری** است — زمان شروع در دو مکان مستقل با checksum HMAC ذخیره می‌شود.

### 💰 خرید لایسنس

در برنامه روی **«خرید لایسنس»** کلیک کنید — تمپلیت ایمیل آماده باز می‌شود:

> 📧 **p00rija@tutamail.com**
> 💎 **TON:** `UQCEgGxRZ5A101w6RBNLwHhnva5EdK3kyDsFQcxni35DlCJf`

| پلن | مدت |
|------|------|
| ماهانه | ۳۰ روز |
| سه‌ماهه | ۹۰ روز |
| شش‌ماهه | ۱۸۰ روز |
| سالیانه | ۳۶۵ روز |
| دائمی | همیشه |
| دلخواه | چند-سرور، شرایط سفارشی |

### 🔧 تنظیمات

| متغیر | پیش‌فرض | کاربرد |
|-------|---------|--------|
| `ADMIN_PASSWORD` | `admin123` | ورود CMS — **فوراً عوض کنید** |
| `AUTH_SECRET` | خودکار | کلید رمزنگاری نشست |
| `DATABASE_URL` | `file:/app/db/custom.db` | مسیر SQLite |
| `AI_API_KEY` | — | کلید سرویس هوش مصنوعی (پیکسل‌پت) |
| `GROQ_API_KEY` | — | کلید Groq (پشتیبان) |

### 📞 تماس

> 📧 **p00rija@tutamail.com**
> 💎 **TON:** `UQCEgGxRZ5A101w6RBNLwHhnva5EdK3kyDsFQcxni35DlCJf`

---

<div align="center">

**⭐ Star this repo if you find it useful! ⭐**

</div>

## License

Copyright © 2026 P00RIJA. All rights reserved.

This software is licensed under a proprietary commercial license — see [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md) for full terms.
