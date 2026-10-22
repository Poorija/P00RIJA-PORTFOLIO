# پورتفولیو P00RIJA

پورتفولیوی دوزبانه‌ی تعاملی + CMS کامل، ساخته‌شده با **Next.js 16** (App Router، خروجی standalone)، React 19، Tailwind 4، Prisma/SQLite، Three.js و Lenis — به‌گونه‌ای طراحی شده که روی سرور ضعیف **۱ هسته / ۵۱۲ مگابایت** هم راحت اجرا شود.

تماس: `p00rija@tutamail.com` · لایسنس: **تجاری اختصاصی (متن کامل در [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md))** — برنامه فقط با فایل لایسنسِ امضاشده اجرا می‌شود؛ بخش «لایسنس تجاری» را ببینید.
English version: [README.md](README.md)

> توزیع عمومی در حالت **Null** شروع می‌شود (`docker-compose.null.yml` یا `P00RIJA_DISTRIBUTION_MODE=null`): تا وقتی صاحب سایت وارد نشود، هیچ هویت و محتوایی نمایش داده نمی‌شود و فقط کارت توسعه‌دهنده باقی می‌ماند.

## ویژگی‌ها

- 🪐 **ناوبری سه‌بعدی سیاره‌ای** بین سه دنیا: گرافیک · امنیت · هوش مصنوعی
- 🎮 **مرکز بازی (Galaxy Arcade)** — ۲۶ بازی داخلی در اورلی کنسولی (دکمه هدر، کلید `G` یا `Ctrl/⌘+K`)، توقف با `Esc`، رکورد هر بازی، کنترل‌های امن برای RTL
- 💻 **ترمینال امنیتی تعاملی** — حدود ۷۰ دستور، TAB-completion، ابزارهای سیستم/شبکه/رمزنگاری
- 📊 **آمار بازدیدکنندگان first-party** در CMS: نشست‌ها، مدت حضور، IP و Geo-IP، مرورگر/دستگاه، رفررها، نمودار ۳۰ روزه، نقشه زنده‌ی جهان با کمان اتصال‌ها — بدون کوکی، احترام به Do-Not-Track و **هیچ ردیابی قبل از رضایت**
- 🛡 **سد دفاعی** — فیلتر ربات/اسکنر، rate limiting، بن خودکار، لیست سیاه/سفید، فید زنده تهدیدها (با `proxy.ts` در Next 16، بدون وابستگی)
- 🧩 **CMS کامل** — همه‌ی بخش‌ها، تم، چیدمان گالری، فرم‌ساز کشیدنی (ارسال با Telegram/WhatsApp/SMTP)، پخش‌کننده موسیقی، کارخانه اشیاء سه‌بعدی، اسنپ‌شات محتوا به‌تفکیک دستگاه، فیلدهای SEO، کتابخانه رسانه با ویرایش ffmpeg
- 🔐 احراز هویت سخت‌گیرانه — هش PBKDF2، TOTP اختیاری، قفل ورود بعد از ۳ شکست، نشست‌های HMAC
- 🍪 **دروازه رضایت GDPR/CCPA** — تحلیل‌های بیرونی (GA4، GTM، Hotjar، Plausible، Matomo، Cloudflare، HubSpot) فقط بعد از رضایت صریح بارگذاری می‌شوند
- 📦 **اینستالر تک‌فایلی**، پکیج کلین گیت‌هاب، و **ایمیج داکرِ کلین با راه‌اندازی صفر-کانفیگ**

## لایسنس تجاری (راهنمای فروشنده)

نسخه‌ی تجاری **تا وارد کردن فایل لایسنسِ امضاشده کاملاً قفل است** و هر ۱۰ دقیقه با سرور لایسنس چک می‌کند — با ابطال/انقضا (یا در دسترس نبودن سرور فراتر از مهلت)، کل سایت به صفحه‌ی نگهداری می‌رود و با معتبر شدن دوباره‌ی لایسنس خودکار برمی‌گردد.

**تنظیم یک‌باره‌ی فروشنده** (روی سیستم خودتان):

```bash
node scripts/license-cli.mjs keygen        # → LICENSE_AES_KEY، LICENSE_SIGN_PRIVKEY (محرمات!)، LICENSE_SIGN_PUBKEY
```

`LICENSE_AES_KEY` و `LICENSE_SIGN_PUBKEY` را در env ایمیج «فروشی» بگذارید (هرگز در ایمیج عمومی) — بدون این کلیدها لایسنس کاملاً غیرفعال است (نسخه‌ی توسعه/عمومی آزاد کار می‌کند).

**اجرای سرور لایسنس** (روی سرور خودتان؛ داکر-بیس تا با سرویس‌های دیگر تداخل نکند؛ کانتینر با `network_mode: host` مستقیم روی کارت شبکه اصلی می‌نشیند تا نصب‌های روی سرورهای دیگر به `http://<این-سرور>:<PORT>` برسند):

```bash
# گزینه A — آرشیو آماده (بدون بیلد روی سرور):
docker load -i p00rija-license-server-v<نسخه>-amd64.tar.gz
# گزینه B — بیلد از سورس:
#   docker compose -f docker-compose.license.yml up -d --build
# مقدار ADMIN_TOKEN و LICENSE_PORT (پیش‌فرض 7800) را در فایل .env کنار compose بگذارید:
echo 'LICENSE_ADMIN_TOKEN=یک-توکن-طولانی'  > .env
echo 'LICENSE_PORT=7800'                  >> .env
docker compose -f docker-compose.license.yml up -d
# داشبورد گرافیکی: http://<host>:7800/admin
```

**صدور لایسنس** (مدت، تعداد نصب، سقف مصرف، آدرس/پورت سرور — همه دستی شما؛ همه‌ی اطلاعات اتصال داخل خود فایل لایسنس است):

```bash
export LICENSE_AES_KEY=… LICENSE_SIGN_PRIVKEY=… \
       LICENSE_ADMIN_URL=http://127.0.0.1:7800 LICENSE_ADMIN_TOKEN=…
node scripts/license-cli.mjs create --licensee "Acme" --plan annual \
  --devices 2 --uses 100000 --server-url http://licenses.acme-host --server-port 7800 \
  --out acme.lic          # ثبت سمت سرور هم با همان شناسه (داشبورد یا CLI)
node scripts/license-cli.mjs list|show|revoke|suspend|activate|extend|set|reset-devices --license-id P00-…
```

**سمت مشتری:** سایتِ قفل فقط `/license` را می‌دهد — فایل `.lic` را آپلود (یا محتوایش را بچسبانید) و سایت باز می‌شود. هر نصب یک UUID یکتا می‌گیرد که سرور نسبت به سقف نصب لایسنس می‌شمارد؛ heartbeat هر ۱۰ دقیقه آن را زنده نگه می‌دارد.

متن حقوقی کامل: [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).

## نصب خودکار

### داکر محلی

```bash
curl -fsSL https://raw.githubusercontent.com/Poorija/P00RIJA-PORTFOLIO/main/scripts/install-from-github.sh | sudo -E bash
```

پیش‌نیازها را چک می‌کند، در صورت نیاز Docker نصب می‌کند، مخزن را در `/opt/p00rija-portfolio` کلون می‌کند، فضای پایدار می‌سازد، CPU/RAM را تشخیص می‌دهد و برنامه را بالا می‌آورد.

### دامنه‌ی واقعی با HTTPS

رکورد DNS دامنه را به سرور اشاره دهید، سپس:

```bash
curl -fsSL https://raw.githubusercontent.com/Poorija/P00RIJA-PORTFOLIO/main/scripts/install-from-github.sh -o /tmp/p00rija-install.sh
sudo env \
  P00RIJA_DOMAIN='portfolio.example.com' \
  P00RIJA_PUBLIC_PORT='443' \
  P00RIJA_SSL_MODE='le' \
  P00RIJA_LE_EMAIL='admin@example.com' \
  P00RIJA_ADMIN_PASSWORD='رمز-قوی-شما' \
  bash /tmp/p00rija-install.sh
```

این حالت پشت Nginx نصب می‌کند، HTTP را به HTTPS می‌برد، گواهی Let's Encrypt می‌گیرد و تمدید خودکار را فعال می‌کند. برای تست محلی از `P00RIJA_SSL_MODE=self-signed` استفاده کنید.

## ⚠️ پسورد پیش‌فرض CMS

پسورد پیش‌فرض مدیریت CMS برابر **`admin123`** است — یک مقدار عمومی و مستند که فقط برای «راه‌اندازی بدون هیچ تنظیمی» وجود دارد. **تا وقتی عوضش نکنید هر کسی می‌تواند وارد CMS سایت شما شود.**

- اینستالر تعاملی موقع نصب **سوال می‌کند** (خالی بگذارید = قبول مقدار پیش‌فرض).
- کاربران داکر: کانتینر را با `-e ADMIN_PASSWORD="رمز-قوی"` اجرا کنید، یا بعد از اولین ورود از تنظیمات CMS عوضش کنید.
- در اولین بوت، یک فایل اطلاع‌رسانی `CMS-PASSWORD.txt` کنار دیتابیس نوشته می‌شود.
- مرجع: [`DEFAULT-CMS-PASSWORD.txt`](DEFAULT-CMS-PASSWORD.txt) و [`.env.example`](.env.example).

## نصب دستی

```bash
git clone https://github.com/Poorija/P00RIJA-PORTFOLIO.git
cd P00RIJA-PORTFOLIO
cp .env.example .env      # ADMIN_PASSWORD و AUTH_SECRET را تنظیم کنید (openssl rand -hex 32)
```

سپس یکی از این روش‌ها:

**ایمیج آماده‌ی Null (بدون هیچ تنظیمی):**

```bash
docker compose -f docker-compose.null.yml pull   # یا: docker load -i <آرشیو>
docker compose -f docker-compose.null.yml up -d
```

**ایمیج کلین کامل (بدون هیچ تنظیمی):**

```bash
docker load -i p00rija-portfolio-image-v<نسخه>.tar.gz   # یا: docker pull p00rija/portfolio:latest
docker compose -f docker-compose.hub.yml up -d
# → http://localhost:3000
```

**بیلد از سورس:**

```bash
npm ci
npx prisma generate && npx prisma db push
npm run build
sudo bash install.sh --docker     # یا ویزارد تعاملی: sudo bash install.sh --web
```

محیط توسعه با hot-reload:‏ `docker compose -f docker-compose.dev.yml up --build` →‏ `http://127.0.0.1:7890`

## تنظیمات (متغیرهای محیطی)

| متغیر | پیش‌فرض | کاربرد |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin123` ⚠️ | ورود CMS — فوراً عوض کنید؛ رمزی که از CMS تنظیم شود (هش) اولویت دارد |
| `AUTH_SECRET` | در داکر خودکار / در نصب بومی اجباری | کلید HMAC نشست‌های CMS |
| `DATABASE_URL` | `file:/app/db/custom.db` | مسیر SQLite |
| `PORT` | `3000` | پورت HTTP |
| `P00RIJA_DISTRIBUTION_MODE` | `null` (نصب‌های عمومی) | حالت `null` هویت/محتوا را تا ورود مالک پنهان می‌کند |
| `P00RIJA_CPUS` / `P00RIJA_MEMORY_LIMIT` | تشخیص خودکار | سقف منابع کانتینر |
| `SMTP_PASS` | — | رمز SMTP برای ارسال سمت‌سرور فرم تماس |

## CMS، ریست کارخانه، بکاپ

از هدر وارد CMS شوید. بیلدر بصری از جابه‌جایی/تغییر اندازه/چرخش اشیاء سه‌بعدی، اسنپ‌شات محتوا به‌تفکیک دستگاه (Automatic/Desktop/Tablet/Mobile) با ارث‌بری، کتابخانه رسانه و آیکون (برش/تغییر اندازه/WebP/تریم ویدیو/پیش‌نمایش GLB)، فرم‌های چندمرحله‌ای کشیدنی، نسخه‌های نام‌دار و undo/redo پشتیبانی می‌کند. **ریست کارخانه** برنامه را به بوم خالی Null برمی‌گرداند و فقط کارت توسعه‌دهنده را حفظ می‌کند.

**CMS → Migration & Backup** یک آرشیو کامل `.p00backup.gz` (محتوا، فایل‌ها، هش رمز، 2FA) می‌سازد که روی هر نمونه‌ی دیگری بازیابی می‌شود؛ مهاجرت سرور-به-سرور هم با `scripts/migrate.sh` انجام می‌شود.

## ساخت خروجی‌های توزیع

```bash
bash scripts/make-clean-package.sh --image
```

خروجی‌ها در `dist/`:

- `p00rija-portfolio-clean-v<نسخه>.tar.gz` / `.zip` — **پکیج فقط-سورس برای گیت‌هاب**: بدون `.env`، بدون دیتابیس، بدون آپلودها، بدون خروجی بیلد (با چک‌های خودکار صحت‌سنجی می‌شود)؛ همراه `DEFAULT-CMS-PASSWORD.txt` و اینستالر
- `p00rija-portfolio-image-v<نسخه>.tar.gz` — **ایمیج پروداکشن کلین** برای `docker load` / داکر هاب (`docker push p00rija/portfolio:v<نسخه>`)

ایمیج از داخل همان پوشه‌ی کلین بیلد می‌شود؛ بنابراین هیچ رازی نمی‌تواند وارد هیچ لایه‌ای شود.

## اعمال آپدیت روی سرور ضعیف

سرور پروداکشن هرگز بیلد نمی‌کند (۱ هسته/۵۱۲MB) — ایمیج آماده را بفرستید:

```bash
bash scripts/deploy-image.sh user@server 22
```

## آپدیت و عیب‌یابی

```bash
sudo bash install.sh --status
sudo bash install.sh --update-docker
docker logs --tail 200 p00rija-portfolio
```

هرگز `.env`، بکاپ‌ها، فایل‌های دیتابیس و کلیدهای خصوصی را کامیت نکنید.

مستندات بیشتر: [DEPLOYMENT.md](DEPLOYMENT.md) · [PROJECT_DOCS.md](PROJECT_DOCS.md) (معماری، فارسی)
