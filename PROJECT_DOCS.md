# P00RIJA PORTFOLIO — مستندات کامل پروژه

> آخرین به‌روزرسانی: ۲۰۲۶-۱۰-۲۳ · این فایل نقشه‌ی کامل معماری، ساختار، جریان‌ها و دیپلوی پروژه است.
> **محدودیت سرور هدف: ۱ هسته CPU و ~۹۰۰ مگابایت RAM — بیلد فقط روی سیستم محلی (Docker) انجام می‌شود و ایمیج آماده به سرور منتقل می‌شود.**

---

## ۰. ویژگی‌های اضافه‌شده در این نسخه (۲۰۲۶-۰۹-۱۲)

| ویژگی | فایل‌های کلیدی |
| --- | --- |
| 🎮 **مرکز بازی (Galaxy Arcade)** — دکمه دسته در هدر (دسکتاپ+موبایل)، اورلی کنسولی با ۲۴ بازی، دسته‌بندی (Arcade/Puzzle/Brain/Reflex/Classic)، رکورد در localStorage، لود تنبل هر بازی با next/dynamic، کلید G و Esc | `game-center.tsx`, `games/registry.tsx`, `games/shared.tsx` |
| 🕹 **۲۱ بازی جدید**: Neon Snake، Quantum Pairs، Tic-Tac-Toe (minimax)، Photon Reflex، Photon Whack، 2048 Fusion، Stack Tower، Brick Blaster، Orbit Pong، Flappy Orb، Mine Hunter، Mini Sudoku، Crypto Word، Typing Sprint، Aim Trainer، Slide Puzzle، RPS، Lights Out، Higher-Lower، Stroop Rush، Asteroid Dodge | `games/*-game.tsx` |
| ↩️ بازی‌های CodeBreaker/ColorMixer/NeuralMemory از سکشن‌ها به مرکز بازی منتقل شدند (کامپوننت‌ها همان قبلی) | `graphics-section.tsx`, `ai-section.tsx`, `security-section.tsx` |
| 💻 **ترمینال امنیت ۲.۰** — ~۶۰ دستور در رجیستری (`help`/`man`/TAB-completion از یک منبع)، دستورات سیستمی (free/df/ps/systemctl/docker/kubectl…)، شبکه (whois/iptables/ufw/fail2ban/waf/scan)، رمزنگاری (base64/rot13/morse/uuid/pwgen/calc با پارسر امن بدون eval)، یکپارچگی سایت (`games`، `play <id>`، `goto`، `lang`، `theme`، `visitor`) و سرگرمی (matrix/sl/weather/8ball…) | `interactive-terminal.tsx` |
| 📊 **مرکز آمار بازدیدکنندگان در CMS** — first-party: تعداد، مدت جلسه، IP، لوکیشن (ip-api batch کش‌شده)، مرورگر/OS/دستگاه/نمایشگر/زبان/رفرر + نمودار ۳۰روزه (Recharts)، میله‌ای مدت حضور، پای مرورگر/دستگاه، جدول زنده «همین لحظه» و نشست‌های اخیر؛ بدون کوکی، احترام به Do-Not-Track. v2.3.1: پس از Wipe، رویداد `analytics-wiped` → ترکر فوراً ping می‌زند و ping بدون سطر، نشست را بازسازی می‌کند (Live-now دیگر صفر نمی‌ماند)؛ نود SERVER روی نقشه از IP عمومی واقعی سرور مکان‌یابی می‌شود (`getServerGeo` کش ۲۴ساعته با lat/lon — دیگر تهران هاردکد نیست) | `visitor-tracker.tsx`, `api/track`, `api/analytics/*`, `cms-analytics-center.tsx`, `cms-world-map.tsx`, `lib/analytics.ts`, `VisitSession` model |
| 🖱 **قفل اسکرول پاپ‌آپ‌ها (v2.3.1)** — هوک `useSuspendLenis(active)` (Lenis stop + overflow lock، شمارنده‌ای) روی همه‌ی اورلی‌ها: ProfileModal (خورشید)، Arcade، LoginModal، Achievements، DeveloperDialog، VirtualGallery، HintCard، MusicPlayer؛ + `data-lenis-prevent` روی نواحی اسکرول‌شونده‌ی داخلی (گرید آرکید، بدنه پروفایل، پلی‌لیست، ترمینال). موس داخل پاپ‌آپ = فقط همان اسکرول می‌شود، پس‌زمینه فریز | `smooth-scroll.tsx` (`useSuspendLenis`), `profile-modal.tsx`, `game-center.tsx`, `login-modal.tsx`, `achievements.tsx`, `developer-card.tsx`, `virtual-gallery.tsx`, `easter-eggs.tsx`, `music-player.tsx`, `interactive-terminal.tsx` |
| 🔐 **لایسنس تجاری (v2.4.0)** — برنامه بدون لایسنس کاملاً قفل: proxy فقط `/license` + `/api/license/*` را می‌گذارد (بقیه 307/503). فایل لایسنس `.lic` = AES-256-GCM payload + امضای Ed25519 (کلید عمومی داخل ایمیج فروشی؛ AES هم برای محرمانگی). همه‌ی اطلاعات اتصال به سرور لایسنس (url/port/heartbeat) داخل خود فایل است. هر نصب UUID یکتا می‌گیرد (شمارش اسلات چند-سروری). heartbeat هر ۱۰ دقیقه (فرصت‌طلبانه از ترافیک + تایمر instrumentation): ابطال/انقضا/سقف مصرف/ردِ سرور → قفل فوری؛ قطعی سرور → grace (پیش‌فرض ۲ چک) → صفحه نگهداری؛ معتبر شدن دوباره → بازیابی خودکار. **سرور لایسنس** مستقل صفر-وابستگی (JSON اتمی، پورت از کانفیگ، ADMIN_TOKEN) با **داشبورد گرافیکی** `/admin` (ساخت/ویرایش دستی همه‌فیلدها/تمدید/تعلیق/ابطال/ریست نصب‌ها/شمارش مصرف) + **CLI** (`scripts/license-cli.mjs`: keygen/create/list/revoke/extend/set…). فقط با وجود `LICENSE_AES_KEY`+`LICENSE_SIGN_PUBKEY` فعال می‌شود → dev و ایمیج عمومی آزاد می‌مانند. لایسنس پروژه GPL-3.0 → **تجاری اختصاصی** (`LICENSE-COMMERCIAL.md`) | `src/lib/licensing.ts`, `src/lib/license-heartbeat.ts`, `src/instrumentation.ts`, `src/proxy.ts`, `src/app/license/`, `src/app/api/license/*`, `license-server/*`, `Dockerfile.license`, `docker-compose.license.yml`, `scripts/license-cli.mjs` |
| 🛡 **سد دفاعی (Defense Center) در CMS** — `proxy.ts` (Next 16، جایگزین middleware) روی هر درخواست: بلاک ربات/اسکنر (sqlmap، nikto، curl، headless، SEO-harvester — گوگل/بینگ همیشه آزاد)، مسیرهای حساس (`.env/.git/wp-admin/…`)، ریت-لیمیت پنجره‌متحرک + بن خودکار، blocklist/allowlist، ۴ حالت (Off/Log/Balanced/Strict)، فید زنده تهدید، تست‌کننده dry-run. وضعیت = فایل JSON کنار DB (بدون Prisma در proxy، سبک برای ۱ هسته) | `proxy.ts`, `lib/defense.ts`, `api/defense`, `cms-defense-center.tsx` |
| ✨ **نرمی انیمیشن** — لایه‌ی کامپوزیتور برای گرادیان‌های blur بخش‌ها، easing سراسری expo-out، `will-change` هدفمند | `globals.css` (بخش SMOOTHNESS PASS) |
| 🌊 **اسکرول سیال (Lenis)** — کتابخانه‌ی `lenis` با lerp 0.09؛ wheel به‌جای پله‌ای، نرم و اینرسی‌دار. غیرفعال برای reduced-motion و حالت انیمیشن «خاموش» و موبایل تاچ. اسکرول‌های برنامه‌ای (لینک‌های #) از `window.__lenis.scrollTo` عبور می‌کنند | `smooth-scroll.tsx`, `content-boot.tsx`, CSS کلاس‌های `html.lenis` |
| 🔧 **فیکس فریز اسکرول (پروفایل‌شده)** — چهار عامل اصلی: ① `mix-blend-mode: screen` لکه‌های FlowBackground با محتوای متحرک re-composite می‌شد (p90 فریم ۳۰۷ms) → گروه با `isolate` محصور شد (→۴۶ms)؛ ② اشیاء WebGL محیطی با هر عبور اسکرول destroy/rebuild می‌شدند (کامپایل shader ~۸۰۰ms) → hysteresis: ساخت در ۶۰۰px، آزادسازی در ۳۰۰۰px؛ ③ `scale()` داخل keyframeهای liquid باعث re-raster دائمی لایه‌های blur می‌شد → حذف شد؛ ④ صحنه‌ی Three سکشن گرافیک به inView وابسته بود → یک‌بار ساخت + gate حلقه با ref | `flow-background.tsx`, `ambient-3d-object.tsx`, `globals.css`, `graphics-section.tsx` |
| 🎨 **مرز سکشن‌ها v2** — نوار قبلی plateau ماسک داشت که مثل «خط قرمز نازک» دیده می‌شد → ماسک تک‌قله‌ای (اوج در درز، محو دوطرفه) + آلفای ۶-۷٪. درخشش‌های داخلی سکشن‌ها (کاتِ لبه‌ای) با ماسک عمودی ۱۱۰px محو می‌شوند. حباب synthesis: عرض ۸۰vw (۱۰٪ هر طرف)، ارتفاع ۱۳۵٪ با مرکز پایین‌تر (کشیده به سمت مرز بعدی)، گرادیان با توقف شفاف واقعی (بدون لبه‌ی بیضی) | `globals.css`, `synthesis.tsx` |
| 🏛 **موزه‌ی مجازی اول‌شخص (v3.7.0)** — تالار CSS-3D حذف و با موزه‌ی واقعی WebGL (Three.js) جایگزین شد: دوربین اول‌شخص با head-bob، هاب مرکزی + یک راهرو (بال) برای هر بخشِ دارای گالری (گرافیک/امنیت/AI + بخش‌های سفارشی)، قاب‌های نورانی با پلاک، مخروط نور، برخورد دیوار، PointerLock دسکتاپ + WASD + جوی‌استیک لمسی + درگ نگاه، Tab=روبه‌روی اثر بعدی، Enter/تپ=رفتن روان به اثر + باز شدن کاتالوگ ورق‌خور، مینی‌مپ زنده (نقشه بالا-پایین همه بال‌ها + نقطه بازدیدکننده + مخروط جهت)، قفل بال/پروژه از داخل موزه (دیالوگ PIN)، پروفایل کارایی (DPR≤1.25 بدون AA روی لمسی) | museum-gallery.tsx, virtual-gallery.tsx |
| 🔐 **Access Guard v3.4.0 — قفل پروژه‌های تکی گالری** — هر **پروژه‌ی تکی** داخل هر گالری (گرافیک/امنیت/AI/بخش‌های سفارشی) با تارگت `proj:<sectionId>:<slug-of-title>` مستقل قابل قفل است؛ سرور پروژه‌ی قفل‌شده را با **stub هویت‌دار** جایگزین می‌کند (فقط title+category می‌ماند؛ images/description/specs خالی + `locked:true`) و ایندکس‌ها بین fa/en همگام می‌شوند (قفل با عنوان هر زبانی، هر دو کارت را می‌بندد)؛ کارت قفل در گالری (LockedProjectSlide سینمایی + بج در grid/masonry/spotlight) کلیک → دیالوگ PIN → آنلاک → رفرش تک‌سواپ، پروژه‌ی واقعی جای stub را می‌گیرد؛ پنل CMS گروه جدید «قفل پروژه‌های تکی گالری» با ردیف‌های زنده (پروژه‌ی جدید/حذف‌شده خودکار می‌آید)؛ کلیدهای رندر گالری به `${i}-${locked|open}` تغییر کرد (تعویض تمیز stub→real) | `src/lib/guard-targets.ts`, `site-protection.ts (stripProjectsFromSection)`, `api/content*`, `virtual-gallery.tsx`, `cms-site-guard.tsx` |
| 🔐 **Access Guard v3.3.3 — فیکس کرش موبایل** — روی موبایل، blur(18px) روی سکشن سنگین + حلقه‌های WebGL زنده زیر بلر، حافظه‌ی GPU iOS را می‌کشت و Safari تب را سفید می‌کرد (چند میلی‌ثانیه بعد از ورود سکشن قفل‌شده به ویو). فیکس: در عرض <۷۶۸px حالت قفل **اسکلت سبک** رندر می‌شود (گرادیان رنگ سکشن + placeholder + UI قفل؛ children واقعی و canvas ها اصلاً mount نمی‌شوند — ۰ canvas تأیید شد)؛ دسکتاپ بلر قبلی را حفظ می‌کند؛ دیالوگ آنلاک در موبایل بالا-چین شد (زیر کیبورد نمی‌رود: items-start + pt-[10vh])؛ exit-relock هنگام باز بودن دیالوگ اجرا نمی‌شود (کوچک‌شدن viewport توسط کیبورد IO را نمی‌فریبد) | `section-guard.tsx`, `guard-activity-watcher.tsx` | 
| 🔐 **Access Guard v3.3.2 — سیاست‌های قفل مجدد + رفع لگ** — برای هر قفل: «قفل مجدد بعد از بیکاری» (idleMinutes تا ۲۴۰ دقیقه؛ ساعت فعالیت سراسری pointer/keys/scroll/touch؛ پس از انقضا کوکی آنلاک از سمت سرور حذف و محتوا دوباره strip می‌شود — واقعی، نه صرفاً ظاهری) و «قفل مجدد هنگام خروج» (IntersectionObserver روی data-guard-target؛ فقط بعد از دیده‌شدن اولیه؛ grace ۷۰۰ms؛ برای گالری‌ها با بستن پاپ‌آپ via useGalleryGate.onPopupClose)؛ endpoint جدید POST /api/protection/relock {targets[]} (بدون auth — logout-semantic)؛ **رفع لگ آنلاک**: رفرش تک‌سواپ applyGuardAndContentRefresh (guard+content در یک set → یک رندر کامل به‌جای دو رندر متوالی stale+fresh؛ قبلاً stutter قابل مشاهده بود)؛ GuardLockInfo += idleMinutes/relockOnExit + guardUnlockedAt | `site-protection.ts`, `api/protection/relock`, `content-store.ts`, `guard-activity-watcher.tsx`, `section-guard.tsx`, `cms-site-guard.tsx`, ۴ فراخوان onClose گالری | 
| 🔐 **Access Guard v3.3.1** — ارقام فارسی/عربی در PIN ها خودکار به لاتین نرمال می‌شوند (`persian-digits.ts` — فیکس باگ «PIN must be exactly 6 digits» با کیبورد فارسی)؛ **رمز موقت** با انقضای خودکار (پیش‌تنظیم ۱س/۲۴س/۷روز یا تاریخ دلخواه؛ همان نوع رمز؛ تلاش ناموفق روی هر دو شمارنده دارد؛ اکشن cleartemp)؛ **قفل مستقل برای هر گالری** (`gallery:<sectionId>` — strip فقط payload گالری از /api/content؛ دکمه گالری برای بازدیدکنقه به دیالوگ PIN می‌رود و بعد از آنلاک+refetch گالری باز می‌شود؛ مدیر همیشه bypass)؛ **گالری برای هر بخش سفارشی**: دکمه «افزودن گالری» در فرم بخش سفارشی (PortfolioGalleryFields مشترک) + نمایش دکمه/پاپ‌آپ در CustomSectionView؛ ردیف‌های پنل قفل live از builder می‌آیند (بخش/گالری جدید خودکار ظاهر می‌شود) + دکمه بازخوانی | `src/lib/site-protection.ts`, `persian-digits.ts`, `api/protection/*`, `api/content/*`, `section-guard.tsx (GuardUnlockDialog + useGalleryGate)`, `custom-section-view.tsx`, `cms-site-guard.tsx`, `cms-panel.tsx` |
| 🔐 **قفل رمز سایت و بخش‌ها — Access Guard (v3.3.0)** — مالک می‌تواند کل سایت یا هر بخش از صفحه اصلی (hero/graphics/security/ai/timeline/synthesis/footer/custom-*) را با رمز محافظت کند: PIN ۴/۶ رقمی (input-otp) یا رمز متنی؛ حالت «همیشه باز» یا «سقف N تلاش» (بعد از N رمز اشتباه قفل تا ریست مدیر غیرفعل می‌شود، مثل کارت بانکی)؛ کوکی آنلاک امضاشده HMAC httpOnly با عمق configurable (session تا ۹۰ روز)؛ **محتوای واقعی بخش قفل‌شده سمت سرور از /api/content حذف می‌شود** (بلر صرفاً نمایشی است — دور زدن مرورگری ممکن نیست)؛ قفل کل سایت: proxy همه‌جا بجز /gate و /api/protection و /api/auth را می‌بندد (نشست CMS همیشه عبور می‌کند؛ مسیر بازیابی: «ورود مدیر» در /gate یا ویرایش db/site-protection.json). پنل مدیریت در CMS → ابزارها → Access Guard | `src/lib/site-protection.ts`, `src/app/api/protection/*`, `src/proxy.ts`, `src/app/gate/`, `src/components/portfolio/section-guard.tsx`, `cms-site-guard.tsx`, `portfolio-section-stack.tsx` |
| 🧹 **پاکسازی و آپدیت‌های v3.3.0** — Next.js 16.4.2، three 0.186، lucide-react 1.61 (آیکون‌های برند Github/LinkedIn/Twitter به SVG داخلی منتقل شدند)، nodemailer 10.2.1، zustand 5.0.16، حذف uuid بلااستفاده؛ ایمیج پایه node:24-alpine؛ فیکس باگ واقعی rules-of-hooks در PixelBuddy (هوک‌های شرطی → کرش در تعویض cfg)، تایمر Minesweeper از window به useRef، latest-ref در games/shared به effect، eslint+tsconfig حالا dist/ و پکیج‌های قدیمی را نادیده می‌گیرند؛ npm audit رانتایم = 0 | `package.json`, `Dockerfile`, `pixel-buddy.tsx`, `games/*`, `brand-icons.tsx`, `eslint.config.mjs` |
| 🔒 **اسکن امنیتی و فیکس** — آپدیت Next.js 16.1.1→16.3.5 (رفع RCE بحرانی GHSA-p293-qw3h-jr36 و GHSA-2xp9-vwfh-vxw4)، nodemailer 9.1.1، sharp 0.35.4؛ بررسی auth همه‌ی APIها؛ SVG-sanitizer و rate-limit موجود تأیید شد. باگ یافت‌شده: مسدود شدن وب‌سوکت HMR در داکر → `allowedDevOrigins` در `next.config.ts` (فقط dev) + خروج `_next/hmr` از matcher پروکسی | `package-lock.json`, `next.config.ts`, `proxy.ts` |

نکته‌های باقی‌مانده: ۳ حفره‌ی high فقط مربوط به CLI بیلد `prisma` (وابستگی `deepmerge-ts`) است — در رانتایم نیست و صبر برای Prisma 8 نیاز دارد.

---

## ۱. تصویر کلی

پورتفولیو تک‌صفحه‌ای (SPA-مانند) با حال‌وهوای فضایی/سه‌بعدی، دوزبانه (فا/en)، با CMS داخلی و بخش‌های: Hero سیاره‌ای، گرافیک، امنیت (با ترمینال تعاملی)، هوش مصنوعی، خط زمانی، و ترکیب (Synthesis).

| لایه | تکنولوژی |
| --- | --- |
| فریم‌ورک | **Next.js 16.4.2** (App Router, Turbopack, `output: "standalone"`) |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui (Radix) + lucide-react |
| انیمیشن | framer-motion 12 + CSS keyframes + Three.js (اشیاء سه‌بعدی Ambient) |
| وضعیت کلاینت | Zustand (`src/lib/content-store.ts`) |
| دیتابیس | **SQLite** از طریق **Prisma 6** — فایل `db/custom.db` |
| نمودارها | Recharts (در `chart.tsx` آماده؛ برای CMS Analytics استفاده می‌شود) |
| ایمیل | Nodemailer (فرم تماس؛ حالت‌های whatsapp-link/telegram-link/mailto/smtp) |
| احراز هویت | کوکی HMAC-signed + PBKDF2 + TOTP دومرحله‌ای (`src/lib/auth.ts`) |
| زبان | دوزبانه دستی (فایل‌های `contentFa/contentEn`) — نه next-intl runtime |

### محدودیت‌های منابع (مهم)
- سرور: ۱ هسته، ~۹۰۰MB RAM → **هرگز روی سرور بیلد نکنید** (OOM می‌شود).
- `Dockerfile` با `--build-arg P00RIJA_BUILD_MEMORY_MB / P00RIJA_BUILD_CPUS` و `scripts/hardware-profile.sh` پروفایل سخت‌افزاری را کنترل می‌کند.
- `next.config.ts`: `experimental.cpus`، gzip، ETag ضعیف، هدرهای کش برای `/api/content`.
- Runtime container: `node:24-alpine` + sqlite + ffmpeg؛ `pids_limit: 256`، healthcheck روی `/api`.

---

## ۲. ساختار پوشه‌ها

```
P00RIJA_PORTFOLIO/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # فونت Vazirmatn، ThemeProvider، اسکرول‌ریستور
│   │   ├── page.tsx                # صفحه اصلی — ترکیب همه‌ی لایه‌ها
│   │   ├── globals.css             # تم‌ها (oklch)، keyframes، کلاس‌های گرادیان
│   │   ├── not-found.tsx           # صفحه ۴۰۴ + بازی فضایی
│   │   └── api/                    # Route Handlers (همه Node runtime)
│   │       ├── auth/{login,logout,settings,status}
│   │       ├── content/            # GET عمومی + POST/DELETE با auth + [section]/
│   │       ├── contact/            # فرم تماس + honeypot + rate-limit
│   │       ├── developer/unlock/   # قفل مالکیت کارت دولوپر
│   │       ├── migration/{backup,restore}
│   │       ├── radio/[channel]/    # پروکسی SomaFM
│   │       └── uploads/…           # کتابخانه رسانه (+webp با sharp)
│   ├── components/
│   │   ├── ui/                     # ۴۰+ کامپوننت shadcn
│   │   ├── theme-provider.tsx
│   │   └── portfolio/              # ⭐ همه‌ی کامپوننت‌های اختصاصی سایت
│   │       ├── planetary-hero.tsx      # Hero سه‌بعدی با سیاره‌ها (۱۷۱۵ خط)
│   │       ├── portfolio-section-stack.tsx  # موتور رندر سکشن‌ها (builtin+custom)
│   │       ├── graphics-section.tsx    # سکشن گرافیک (+ بازی ColorMixer)
│   │       ├── security-section.tsx    # سکشن امنیت (+ ترمینال + بازی CodeBreaker)
│   │       ├── ai-section.tsx          # سکشن AI (+ بازی NeuralMemory)
│   │       ├── interactive-terminal.tsx# ترمینال شبیه‌سازی‌شده سمت کلاینت (۹۵۲ خط)
│   │       ├── games/                  # ۳ بازی درون‌سکشنی
│   │       ├── game-hub-overlay.tsx    # آرکید مخفی (کلید G) — لینک به سکشن‌ها
│   │       ├── easter-eggs.tsx         # Achievements/Konami/GameHub trigger
│   │       ├── cms-panel.tsx           # ⭐ CMS کامل (۵۰۷۸ خط، تب‌بندی)
│   │       ├── cms-*                   # زیر‌پنل‌های CMS (media, forms, visual-builder…)
│   │       ├── flow-background.tsx / space-comets.tsx / meteor-trail.tsx
│   │       ├── music-player.tsx        # پخش‌کننده + رادیو SomaFM
│   │       └── …
│   ├── hooks/                      # use-mobile, use-toast
│   └── lib/
│       ├── content-store.ts        # ⭐ Zustand store: content, lang, auth, t()
│       ├── content-types.ts        # تایپ‌های SiteContent و SECTION_KEYS
│       ├── default-content.ts      # محتوای پیش‌فرض دوزبانه (۱۴۸۱ خط)
│       ├── blank-content.ts        # محتوای خالی (حالت distribution)
│       ├── content-cache.ts        # کش درون‌حافظه‌ای سرور برای /api/content
│       ├── auth.ts                 # PBKDF2 + HMAC session + TOTP
│       ├── db.ts                   # Prisma singleton
│       ├── i18n.ts                 # ترجمه‌ی UI chrome (fa/en)
│       ├── themes.ts, anim.ts, developer-owner.ts …
│       └── responsive-content.ts   # اورراید محتوا بر اساس دستگاه
├── prisma/ (schema.prisma, init.sql, seed.ts, custom.db)
├── db/custom.db                    # ⭐ دیتابیس واقعی (SQLite)
├── docker/ (nginx configs + entrypoints, certbot)
├── scripts/ (hardware-profile.sh, container-entrypoint.sh, migrate.sh, …)
├── Dockerfile                      # multi-stage: builder (npm ci + next build) → runtime standalone
├── Dockerfile.dev                  # dev با bind-mount و hot-reload
├── docker-compose.dev.yml          # dev: پورت 7890، WATCH_POLL_INTERVAL_MS=300
├── docker-compose.server.yml       # پروداکشن ساده (پورت 7890→3000)
├── docker-compose.web.yml          # ⭐ پروداکشن کامل: app + nginx + SSL (80/443)
├── install.sh                      # نصب‌کننده تعاملی سرور (native/docker/web+SSL)
├── run.sh                          # اجرای محلی native
└── DEPLOYMENT.md                   # مستندات دیپلوی (بکاپ/مهاجرت/SSL)
```

## ۳. جریان‌های اصلی

### ۳.۱ بارگذاری صفحه
1. `layout.tsx` → `ThemeProvider` (dark پیش‌فرض) + فونت وزیرمتن.
2. `page.tsx` ترتیب لایه‌ها: `ContentBoot` → `AnimModeController` → `PageLoader` → `FlowBackground`/`SpaceComets` → `CmsRuntimeController` (هدر runtime CMS) → `SectionDetector` → `CustomCursor` → `ScrollProgress` → `SiteHeader` → `PortfolioSectionStack` → `SiteFooter` + پنل‌های شناور (CMS/Login/Profile/Achievements/Music…).
3. `ContentBoot` → `fetchContent()` در Zustand: ابتدا کش sessionStorage (stale-while-revalidate) بعد `GET /api/content` (کش سرور ۴۵~۱۲۰ ثانیه + `stale-while-revalidate`).
4. `SiteContent` دوزبانه merge می‌شود با `deepMergeDefaults` (پیش‌فرض‌ها + داده‌ی DB) + نرمال‌سازی legacy فارسی + رادیوهای builtin.
5. `PortfolioSectionStack` سکشن‌ها را از `builder.sections` (CMS) مرتب/فیلتر می‌کند؛ builtin renderer + لایه‌های `ObjectLayer/FormLayer/ResumeLayer/VisualLayer` برای هر سکشن.

### ۳.۲ CMS
- باز شدن: دکمه چرخ‌دنده هدر → login modal → `POST /api/auth/login` (rate-limit ۸ تلاش/۱۵د، رمز env یا hash DB، TOTP اختیاری) → کوکی `cms_session` (HMAC، ۷ روز، httpOnly).
- `cms-panel.tsx`: تب‌های 00..14 (site, hero, graphics, security, ai, synthesis, timeline, profile, music, footer, design, meteors, forms, builder, error404) + سکشن‌های ابزاری خارج از تب‌ها: `developer-info`، `media-library`، `migration` (بکاپ/ری‌استور `.p00backup.gz`).
- ذخیره: `POST /api/content {section, lang, data}` (auth) → upsert در `Content` table → `invalidateContent()`.
- الگوی «سکشن ابزاری»: ثابت `*_SECTION_KEY` + شرط `isXSection` در رندر + کامپوننت مستقل — برای افزودن تب‌های جدید از همین الگو استفاده می‌شود.

### ۳.۳ بازی‌ها (وضعیت فعلی — قبل از تغییرات)
| بازی | محل | ذخیره رکورد |
| --- | --- | --- |
| Code Breaker (شکستن رمز) | داخل `security-section.tsx` (پایین صفحه، تمام‌عرض) | `localStorage cb-best-tries` |
| Color Mixer (تطبیق رنگ) | داخل `graphics-section.tsx` | `cm-best-score` |
| Neural Memory (حافظه عصبی) | داخل `ai-section.tsx` | `nm-best-round` |
| Space Survival 404 | صفحه `not-found` | leaderboard `p00rija-404-*` |
| GameHubOverlay | کلید G (easter-eggs) — فقط «اسکرول به سکشن»، بازی مستقل ندارد |

رویداد دستاورد: `window.dispatchEvent(new CustomEvent("achieve", {detail}))` → `easter-eggs.tsx` دستاورد ثبت می‌کند (`code-master`, `color-alchemist`, `neural-mind`, …).

### ۳.۴ ترمینال امنیت
- کامپوننت کلاینت‌محور؛ بدون shell واقعی. بوت با اطلاعات مرورگر کاربر + ~۳۰ دستور (ls/cat/cd/nmap/ping/dig/curl/hash/jwt/neofetch/hack/matrix/asciiquarium/cowsay/…) + Konami → matrix + history (فلش بالا/پایین) + Ctrl+L/C.
- فایل سیستم فیک: `DIR_LISTING`/`FILE_CONTENTS`.

### ۳.۵ تم و زبان
- تم: CSS variables در `globals.css` با oklch (`--gfx-1/2/3`, `--sec-1/2/3`, `--ai-1/2/3`, aurora, surface…) + `next-themes`.
- زبان: `setLang` در Zustand → `document.documentElement.dir = rtl/ltr` + `localStorage p00rija-language`.
- دکمه‌های هدر: `LanguageToggle`, `ThemeToggle`, `MotionToggle` (ناحیه هدف برای دکمه‌ی «مرکز بازی»).

### ۳.۶ انیمیشن
- `AnimModeController`: کنترل سراسری reduce-motion.
- keyframes اصلی: `liquid-1..6, float-slow/medium, spin-slow/reverse, pulse-glow, gradient-shift, blink, neural-pulse, aurora-drift, rise-fade, crt-flicker`.
- Three.js فقط در `ambient-3d-object` (شیء مداری هر سکشن) و Hero.
- GPU hints: کلاس `.gpu`، `transform-gpu`. نکته‌ی باگ ثبت‌شده: `content-visibility:auto` روی سکشن‌ها باعث پرش اسکرول می‌شود — **نباید** اضافه شود.

## ۴. دیتابیس (Prisma/SQLite)

| Model | کاربرد |
| --- | --- |
| `Content` | `section` (unique) + `data` (JSON `{fa,en,_meta}`) — قلب CMS |
| `AuthSettings` | singleton: passwordHash + TOTP |
| `Upload` | فایل‌های base64 (رزومه، آواتار…) |
| `User`, `Post` | بوت‌استرپ قدیمی (در reset پاک می‌شوند) |

مسیر DB: `DATABASE_URL=file:/app/db/custom.db` (در کانتینر volume `web-db` یا `/var/lib/p00rija-portfolio/db`).

## ۵. امنیت فعلی

- کوکی HMAC-SHA256 + exp؛ PBKDF2 (210k iter) برای رمز؛ TOTP اختیاری؛ rate-limit روی login.
- هدرها در `next.config.ts`: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy.
- فرم تماس: honeypot + rate limit + SSRF-guard روی fetchهای خروجی.
- `/api/content`: خواندن عمومی (کش)، نوشتن فقط با auth؛ `?all=1` فقط admin.
- Content-Security-Policy: **تنظیم نشده** (فرصت بهبود).
- در انتقال: nginx + SSL (LE/self-signed/Cloudflare Origin) — `docker-compose.web.yml`.

## ۶. دیپلوی (روش مورد توافق)

1. **توسعه/اعمال تغییرات لوکال**: Docker روی مک (`docker compose -f docker-compose.dev.yml up --build` → `http://127.0.0.1:7890`).
2. **تایید کاربر**.
3. **بیلد ایمیج فقط لوکال**: `docker build` (یا compose web) → `docker save` → انتقال به سرور → `docker load` → up (سرور فقط pull-and-run؛ نه بیلد).
4. سرو پروداکشن: `docker-compose.web.yml` (app + nginx + SSL) یا `docker-compose.server.yml`.
5. بکاپ قبل از دیپلوی: CMS → Migration & Backup (`.p00backup.gz`)؛ حجم دیتابیس = `db/custom.db`.

## ۷. نکات نگهداری

- `AGENTS.md`: Next.js 16 سند نسخه‌محور در `node_modules/next/dist/docs/` — قبل از کدنویسی بخوان. تغییرات breaking مهم: async `cookies()/headers()`، `middleware`→`proxy` (Node runtime)، Turbopack پیش‌فرض.
- `npm run build` خروجی standalone را کامل می‌کند (کپی static+public).
- لاگ‌ها: `dev.log` / `server.log` (tee).
- `.env` نمونه‌ی حداقلی:
  ```
  AUTH_SECRET=<hex 32+>
  ADMIN_PASSWORD=<strong>
  DATABASE_URL=file:/app/db/custom.db
  ```
