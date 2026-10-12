"use client";

import { useMemo, useRef, useState } from "react";
import { BookOpen, Check, Copy, Download, HardDriveDownload, KeyRound, Loader2, RotateCcw, Server, ShieldCheck, Terminal, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lang } from "@/lib/content-types";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

export function MigrationCenter({ lang }: { lang: Lang }) {
  const isFa = lang === "fa";
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"backup" | "restore" | null>(null);
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState("");
  const [user, setUser] = useState("root");
  const [sshPort, setSshPort] = useState("22");
  const [domain, setDomain] = useState("");
  const [publicPort, setPublicPort] = useState("443");
  const [email, setEmail] = useState("");
  const [sslMode, setSslMode] = useState("le");
  const [backupPath, setBackupPath] = useState("");

  const command = useMemo(() => {
    const env = [
      `P00RIJA_TARGET_HOST=${shellQuote(host || "SERVER_IP")}`,
      `P00RIJA_TARGET_USER=${shellQuote(user || "root")}`,
      `P00RIJA_SSH_PORT=${shellQuote(sshPort || "22")}`,
      `P00RIJA_DOMAIN=${shellQuote(domain || "portfolio.example.com")}`,
      `P00RIJA_PUBLIC_PORT=${shellQuote(publicPort || "443")}`,
      `P00RIJA_SSL_MODE=${shellQuote(sslMode)}`,
    ];
    if (sslMode === "le") env.push(`P00RIJA_LE_EMAIL=${shellQuote(email || "admin@example.com")}`);
    if (backupPath.trim()) env.push(`P00RIJA_BACKUP_PATH=${shellQuote(backupPath.trim())}`);
    return `${env.join(" ")} bash scripts/migrate.sh`;
  }, [backupPath, domain, email, host, publicPort, sshPort, sslMode, user]);

  const guideSteps = isFa ? [
    {
      title: "۱. انتخاب سناریو و تهیه نسخه امن",
      body: "برای انتقال لوکال به هاست یا هاست به هاست، ابتدا از همین صفحه «دانلود بک‌آپ کامل» را بزنید. فایل شامل محتوا، کاربران، آپلودها و تنظیمات ورود است.",
      items: ["فایل .p00backup.gz را در فضای رمزگذاری‌شده نگه دارید.", "از دیتابیس یا پوشه‌های برنامه به‌تنهایی کپی نگیرید؛ آرشیو CMS checksum دارد.", "تا پایان تأیید مقصد، نسخه مبدأ را خاموش یا حذف نکنید."],
    },
    {
      title: "۲. آماده‌سازی سرور مقصد",
      body: "یک سرور Linux با دسترسی SSH و کاربر root یا دارای sudo لازم است. نصب‌کننده وجود Docker، Docker Compose، OpenSSL، Curl و CA certificates را بررسی و در صورت نیاز نصب می‌کند.",
      items: ["حداقل پیشنهادی: ۱ هسته CPU، یک گیگابایت RAM و فضای آزاد کافی برای image و backup.", "پورت SSH، پورت ۸۰ و پورت ۴۴۳ را در فایروال و پنل ارائه‌دهنده باز کنید.", "برای پورت SSH سفارشی، همان مقدار را در فرم وارد کنید."],
      command: "ssh -p 22 root@SERVER_IP\nsudo -v\ndocker --version && docker compose version",
    },
    {
      title: "۳. تنظیم DNS و انتخاب گواهی",
      body: "برای Let's Encrypt، رکورد A/AAAA دامنه باید پیش از انتقال به IP مقصد اشاره کند. HTTP-01 به پورت ۸۰ و HTTPS به پورت ۴۴۳ نیاز دارد.",
      items: ["دامنه عمومی: Let's Encrypt را انتخاب کنید.", "localhost، شبکه داخلی یا IP خام: Self-signed را انتخاب کنید.", "در CDN یا NAT، مطمئن شوید ۸۰ و ۴۴۳ به همین سرور forward می‌شوند."],
      command: "dig +short portfolio.example.com\ncurl -I http://portfolio.example.com",
    },
    {
      title: "۴. ساخت و اجرای فرمان مهاجرت",
      body: "فرم بالای این راهنما را کامل کنید. اگر می‌خواهید داده‌ها نیز منتقل شوند، مسیر مطلق فایل بک‌آپ دانلودشده را وارد کنید؛ سپس فرمان امن را کپی و از ریشه پروژه روی دستگاه مبدأ اجرا کنید.",
      items: ["رمز SSH و sudo فقط در ترمینال پرسیده می‌شود و در CMS ذخیره نمی‌شود.", "اسکریپت دسترسی sudo/root را آزمایش می‌کند، سورس را بسته‌بندی و به مقصد منتقل می‌کند.", "سپس Docker، Nginx، SSL و در صورت وجود backup، بازیابی دیتابیس را اجرا می‌کند."],
    },
    {
      title: "۵. تأیید انتقال و HTTPS",
      body: "بعد از پایان، وضعیت کانتینرها، redirect، پاسخ HTTPS و مشخصات گواهی را بررسی کنید. تنها مشاهده صفحه اصلی کافی نیست؛ ورود CMS و یک محتوای آپلودشده را نیز آزمایش کنید.",
      items: ["HTTP باید 301 یا 308 به HTTPS برگرداند.", "API باید پاسخ موفق بدهد و app در Docker healthy باشد.", "در Let's Encrypt صادرکننده نباید self-signed باشد."],
      command: "curl -I http://portfolio.example.com\ncurl -I https://portfolio.example.com\ncurl -fsS https://portfolio.example.com/api\nssh root@SERVER_IP 'cd /opt/p00rija-portfolio && docker compose -f docker-compose.web.yml ps'",
    },
    {
      title: "۶. Rollback و رفع خطا",
      body: "اگر مقصد سالم نبود، سرویس مبدأ را نگه دارید و DNS را به IP قبلی برگردانید. سپس خطا را از لاگ app و Nginx بررسی و مهاجرت را دوباره اجرا کنید.",
      items: ["DNS/SSL: رکورد دامنه، بازبودن ۸۰/۴۴۳ و زمان انتشار DNS را بررسی کنید.", "SSH: کاربر، پورت، کلید/رمز و دسترسی sudo را بررسی کنید.", "Restore: از سالم‌بودن فایل، پسوند .p00backup.gz و فضای دیسک مطمئن شوید.", "پس از تأیید کامل مقصد و یک بک‌آپ جدید، مبدأ قدیمی را بازنشسته کنید."],
      command: "ssh root@SERVER_IP 'cd /opt/p00rija-portfolio && docker compose -f docker-compose.web.yml logs --tail=200 app nginx'",
    },
  ] : [
    {
      title: "1. Choose the scenario and create a safe backup",
      body: "For local-to-host or host-to-host migration, first select Download full backup above. The archive contains content, users, uploads, and authentication settings.",
      items: ["Keep the .p00backup.gz file in encrypted storage.", "Do not copy only the database or app folders; the CMS archive includes integrity checks.", "Keep the source deployment online until the destination passes verification."],
    },
    {
      title: "2. Prepare the destination server",
      body: "Use a Linux server reachable by SSH with root or sudo access. The installer checks Docker, Compose, OpenSSL, Curl, and CA certificates and installs missing prerequisites where supported.",
      items: ["Recommended minimum: 1 CPU core, 1 GB RAM, and enough free disk for the image and backup.", "Allow the SSH port, port 80, and port 443 in both host and provider firewalls.", "Enter the actual port in the form when SSH uses a custom port."],
      command: "ssh -p 22 root@SERVER_IP\nsudo -v\ndocker --version && docker compose version",
    },
    {
      title: "3. Configure DNS and choose a certificate",
      body: "For Let's Encrypt, the domain A/AAAA record must point to the destination before migration. HTTP-01 needs port 80 and HTTPS normally uses port 443.",
      items: ["Public domain: select Let's Encrypt.", "Localhost, LAN, or raw IP: select Self-signed.", "With a CDN or NAT, forward ports 80 and 443 to this server."],
      command: "dig +short portfolio.example.com\ncurl -I http://portfolio.example.com",
    },
    {
      title: "4. Generate and run the migration command",
      body: "Complete the form above. To move data too, enter the absolute path to the downloaded backup, copy the secure command, and run it from the project root on the source machine.",
      items: ["SSH and sudo credentials are requested only by the terminal and never stored in CMS.", "The script verifies root/sudo, packages the source, and transfers it to the destination.", "It then deploys Docker, Nginx, SSL, and restores the backup when supplied."],
    },
    {
      title: "5. Verify migration and HTTPS",
      body: "Check containers, redirect behavior, HTTPS response, and certificate details. Also test CMS login and at least one uploaded asset; loading the home page alone is not sufficient.",
      items: ["HTTP must return a 301/308 redirect to HTTPS.", "The API must respond successfully and the app container must be healthy.", "A Let's Encrypt deployment must not present a self-signed issuer."],
      command: "curl -I http://portfolio.example.com\ncurl -I https://portfolio.example.com\ncurl -fsS https://portfolio.example.com/api\nssh root@SERVER_IP 'cd /opt/p00rija-portfolio && docker compose -f docker-compose.web.yml ps'",
    },
    {
      title: "6. Roll back and troubleshoot",
      body: "If the destination is unhealthy, keep the source service available and point DNS back to the previous IP. Inspect app and Nginx logs, correct the issue, and rerun migration.",
      items: ["DNS/SSL: verify records, ports 80/443, and DNS propagation.", "SSH: verify user, port, key/password, and sudo access.", "Restore: verify the .p00backup.gz archive and free disk space.", "Retire the source only after full destination verification and a fresh destination backup."],
      command: "ssh root@SERVER_IP 'cd /opt/p00rija-portfolio && docker compose -f docker-compose.web.yml logs --tail=200 app nginx'",
    },
  ];

  const downloadBackup = async () => {
    setBusy("backup");
    try {
      const response = await fetch("/api/migration/backup", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(isFa ? "ساخت بک‌آپ ناموفق بود" : "Backup failed");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "p00rija-portfolio.p00backup.gz";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(isFa ? "بک‌آپ کامل دانلود شد" : "Full backup downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isFa ? "خطای بک‌آپ" : "Backup error"));
    } finally {
      setBusy(null);
    }
  };

  const restoreBackup = async (file: File) => {
    const confirmed = window.confirm(isFa
      ? "تمام محتوای فعلی، آپلودها و تنظیمات ورود با این بک‌آپ جایگزین می‌شود. ادامه می‌دهید؟"
      : "Current content, uploads, and login settings will be replaced by this backup. Continue?");
    if (!confirmed) return;
    setBusy("restore");
    try {
      const response = await fetch("/api/migration/restore", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || (isFa ? "بازیابی ناموفق بود" : "Restore failed"));
      toast.success(isFa ? "بازیابی کامل شد؛ صفحه تازه‌سازی می‌شود" : "Restore complete; reloading");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isFa ? "خطای بازیابی" : "Restore error"));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    toast.success(isFa ? "دستور کپی شد" : "Command copied");
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card/45 p-5">
        <div className="flex items-start gap-3">
          <HardDriveDownload className="mt-0.5 size-5 text-[var(--ai-1)]" />
          <div>
            <h3 className="font-bold text-foreground">{isFa ? "بک‌آپ و بازیابی کامل" : "Full backup and restore"}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isFa
                ? "محتوا، سکشن‌های سفارشی، فایل‌های آپلودشده و تنظیمات امنیتی در یک فایل فشرده با checksum ذخیره می‌شوند. فایل حساس است و باید رمزگذاری‌شده نگه‌داری شود."
                : "Content, custom sections, uploads, and security settings are stored in one compressed, checksummed file. This file is sensitive; keep it encrypted."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void downloadBackup()} disabled={busy !== null}>
            {busy === "backup" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {isFa ? "دانلود بک‌آپ کامل" : "Download full backup"}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {isFa ? "بازیابی از بک‌آپ" : "Restore backup"}
          </Button>
          <input ref={fileRef} type="file" className="hidden" accept=".gz,.p00backup.gz,application/gzip" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void restoreBackup(file);
          }} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/45 p-5">
        <div className="flex items-start gap-3">
          <Server className="mt-0.5 size-5 text-[var(--sec-1)]" />
          <div>
            <h3 className="font-bold text-foreground">{isFa ? "مهاجرت لوکال یا هاست به سرور" : "Local or host-to-host migration"}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isFa
                ? "فایل بک‌آپ را دانلود کنید، سپس دستور را در ترمینال دستگاه مبدأ اجرا کنید. SSH و sudo رمز را مستقیم در ترمینال می‌پرسند؛ رمز هرگز وارد CMS یا ذخیره نمی‌شود."
                : "Download a backup, then run the command from the source machine. SSH and sudo prompt in the terminal; passwords never enter or persist in CMS."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><Label>{isFa ? "IP یا هاست مقصد" : "Target IP or host"}</Label><Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="203.0.113.10" /></div>
          <div><Label>{isFa ? "کاربر SSH" : "SSH user"}</Label><Input value={user} onChange={(e) => setUser(e.target.value)} /></div>
          <div><Label>{isFa ? "پورت SSH" : "SSH port"}</Label><Input inputMode="numeric" value={sshPort} onChange={(e) => setSshPort(e.target.value)} /></div>
          <div><Label>{isFa ? "دامنه عمومی یا IP" : "Public domain or IP"}</Label><Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="portfolio.example.com" /></div>
          <div><Label>{isFa ? "پورت HTTPS" : "HTTPS port"}</Label><Input inputMode="numeric" value={publicPort} onChange={(e) => setPublicPort(e.target.value)} /></div>
          <div>
            <Label>{isFa ? "حالت گواهی" : "Certificate mode"}</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={sslMode} onChange={(e) => setSslMode(e.target.value)}>
              <option value="le">Let&apos;s Encrypt</option>
              <option value="self-signed">Self-signed</option>
            </select>
          </div>
          {sslMode === "le" && <div className="sm:col-span-2 lg:col-span-3"><Label>{isFa ? "ایمیل Let's Encrypt" : "Let's Encrypt email"}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" /></div>}
          <div className="sm:col-span-2 lg:col-span-3">
            <Label>{isFa ? "مسیر فایل بک‌آپ در دستگاه مبدأ (اختیاری)" : "Backup path on source machine (optional)"}</Label>
            <Input dir="ltr" value={backupPath} onChange={(e) => setBackupPath(e.target.value)} placeholder="/home/user/Downloads/portfolio.p00backup.gz" />
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {isFa ? "خالی بگذارید تا فقط برنامه منتقل شود؛ برای انتقال محتوا مسیر مطلق فایل را وارد کنید." : "Leave blank to deploy the application only; enter an absolute path to migrate its data."}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
          <code className="block break-all text-[11px] leading-5 text-muted-foreground" dir="ltr">{command}</code>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => void copyCommand()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {isFa ? "کپی دستور امن" : "Copy secure command"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/45 p-5">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 size-5 text-[var(--gfx-1)]" />
          <div>
            <h3 className="font-bold text-foreground">{isFa ? "راهنمای کامل انتقال و بازیابی" : "Complete migration and recovery guide"}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isFa ? "مراحل را به‌ترتیب انجام دهید. بخش اول باز است؛ برای دیدن جزئیات هر مرحله روی عنوان آن کلیک کنید." : "Follow these steps in order. The first step is expanded; select any heading to view its details."}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {guideSteps.map((step, index) => (
            <details key={step.title} className="group rounded-xl border border-border bg-background/45 p-4" open={index === 0 ? true : undefined}>
              <summary className="cursor-pointer list-none font-semibold text-foreground marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  <span>{step.title}</span>
                  <span className="text-muted-foreground transition-transform group-open:rotate-180">⌄</span>
                </span>
              </summary>
              <div className="mt-3 border-t border-border/70 pt-3">
                <p className="text-xs leading-6 text-muted-foreground">{step.body}</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                  {step.items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /><span>{item}</span></li>)}
                </ul>
                {step.command && <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-background p-3 text-left text-[11px] leading-5 text-muted-foreground" dir="ltr"><code>{step.command}</code></pre>}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <TriangleAlert className="size-5 text-amber-500" />
            <p className="mt-2 text-sm font-bold text-foreground">{isFa ? "قبل از شروع" : "Before you start"}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{isFa ? "یک بک‌آپ تازه بگیرید، فضای دیسک مقصد را بررسی کنید و TTL رکورد DNS را از قبل کاهش دهید." : "Create a fresh backup, verify destination disk space, and lower DNS TTL ahead of the cutover."}</p>
          </div>
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
            <RotateCcw className="size-5 text-sky-500" />
            <p className="mt-2 text-sm font-bold text-foreground">{isFa ? "قانون بازگشت" : "Rollback rule"}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{isFa ? "تا وقتی HTTPS، CMS، فایل‌ها و بک‌آپ مقصد تأیید نشده‌اند، سرویس و داده‌های مبدأ را حذف نکنید." : "Do not remove the source service or data until destination HTTPS, CMS, assets, and backup have all been verified."}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/45 p-3 text-xs text-muted-foreground">
          <Terminal className="size-4 shrink-0" />
          <span>{isFa ? "فرمان‌ها باید از ریشه همین پروژه و روی دستگاه مبدأ اجرا شوند." : "Run migration commands from this project root on the source machine."}</span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/35 p-4"><ShieldCheck className="size-5 text-emerald-500" /><p className="mt-2 text-sm font-bold">HTTPS :443</p><p className="mt-1 text-xs text-muted-foreground">{isFa ? "ریدایرکت اجباری از پورت ۸۰" : "Forced redirect from port 80"}</p></div>
        <div className="rounded-xl border border-border bg-card/35 p-4"><KeyRound className="size-5 text-amber-500" /><p className="mt-2 text-sm font-bold">SSH / sudo</p><p className="mt-1 text-xs text-muted-foreground">{isFa ? "اعتبارنامه فقط در ترمینال" : "Credentials stay in terminal"}</p></div>
        <div className="rounded-xl border border-border bg-card/35 p-4"><HardDriveDownload className="size-5 text-[var(--gfx-1)]" /><p className="mt-2 text-sm font-bold">Checksum</p><p className="mt-1 text-xs text-muted-foreground">{isFa ? "اعتبارسنجی قبل از بازیابی" : "Validated before restore"}</p></div>
      </section>
    </div>
  );
}
