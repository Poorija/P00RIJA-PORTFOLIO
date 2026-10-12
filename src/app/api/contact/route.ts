import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { defaultContentEn, defaultContentFa } from "@/lib/default-content";
import type { BuilderConfig, BuilderDevice, FormBuilderConfig, Lang } from "@/lib/content-types";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function isLang(value: unknown): value is Lang {
  return value === "fa" || value === "en";
}

function clientKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function isDevice(value: unknown): value is BuilderDevice {
  return value === "desktop" || value === "tablet" || value === "mobile";
}

async function getForms(lang: Lang, device?: BuilderDevice): Promise<FormBuilderConfig> {
  const defaults = lang === "fa" ? defaultContentFa.forms : defaultContentEn.forms;
  const rows = await db.content.findMany({ where: { section: { in: ["forms", "builder"] } } });
  const row = rows.find((item) => item.section === "forms");
  let forms = defaults;
  try {
    if (row) {
      const parsed = JSON.parse(row.data) as { fa?: unknown; en?: unknown };
      const candidate = parsed[lang];
      if (candidate && typeof candidate === "object") forms = { ...defaults, ...(candidate as FormBuilderConfig) };
    }
  } catch {
    forms = defaults;
  }
  if (!device) return forms;
  try {
    const builderRow = rows.find((item) => item.section === "builder");
    if (!builderRow) return forms;
    const parsed = JSON.parse(builderRow.data) as { fa?: unknown; en?: unknown };
    const builder = parsed[lang] as BuilderConfig | undefined;
    const override = builder?.deviceContentOverrides?.[device]?.forms;
    return override && typeof override === "object"
      ? { ...forms, ...(override as FormBuilderConfig) }
      : forms;
  } catch {
    return forms;
  }
}

function rateLimit(key: string, maxPerHour: number) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  existing.count += 1;
  return existing.count > maxPerHour;
}

function fieldLabel(forms: FormBuilderConfig, formId: string, fieldId: string) {
  return forms.forms.find((form) => form.id === formId)?.fields.find((field) => field.id === fieldId)?.label || fieldId;
}

function providerDefaults(provider: FormBuilderConfig["email"]["provider"]) {
  if (provider === "gmail") return { host: "smtp.gmail.com", port: 465, secure: true };
  if (provider === "microsoft") return { host: "smtp.office365.com", port: 587, secure: false };
  return { host: "", port: 587, secure: false };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const lang: Lang = isLang(body?.lang) ? body.lang : "en";
    const forms = await getForms(lang, isDevice(body?.device) ? body.device : undefined);
    const form = forms.forms.find((item) => item.id === body?.formId) ?? forms.forms[0];
    const values = body?.values && typeof body.values === "object" ? body.values as Record<string, unknown> : {};
    const startedAt = Number(body?.startedAt || 0);
    const elapsed = Date.now() - startedAt;

    if (String(body?.honeypot || "").trim()) {
      return NextResponse.json({ ok: true, blocked: true });
    }

    if (elapsed < Number(forms.antiSpam.minimumSubmitMs || 0)) {
      return NextResponse.json({ ok: false, error: forms.antiSpam.blockedMessage }, { status: 429 });
    }

    if (rateLimit(clientKey(request), Math.max(1, Number(forms.antiSpam.maxPerHour || 8)))) {
      return NextResponse.json({ ok: false, error: forms.antiSpam.blockedMessage }, { status: 429 });
    }

    const missing = form.fields
      .filter((field) => field.required && !String(values[field.id] ?? "").trim())
      .map((field) => field.label);
    if (missing.length) {
      return NextResponse.json({ ok: false, error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    if (!forms.email.enabled) {
      return NextResponse.json({ ok: true, delivery: "disabled" });
    }

    // Server-less providers deliver in the visitor's browser (WhatsApp /
    // Telegram deep links, mailto). If a POST still arrives for them (or
    // for "none"), accept it without touching SMTP.
    if (
      forms.email.provider === "none" ||
      forms.email.provider === "mailto" ||
      forms.email.provider === "whatsapp-link" ||
      forms.email.provider === "telegram-link"
    ) {
      return NextResponse.json({ ok: true, delivery: forms.email.provider });
    }

    const cfg = forms.email;
    const rows = Object.entries(values)
      .map(([key, value]) => `${fieldLabel(forms, form.id, key)}: ${String(value)}`)
      .join("\n");
    const message = `${form.title || form.name}\n\n${rows}`.slice(0, 3900);

    if (cfg.provider === "telegram-bot") {
      const envName = /^[A-Z][A-Z0-9_]*$/.test(cfg.telegramBotTokenEnv || "") ? cfg.telegramBotTokenEnv! : "TELEGRAM_BOT_TOKEN";
      const token = process.env[envName];
      if (!token || !cfg.telegramChatId) return NextResponse.json({ ok: false, error: "Telegram bot token/chat ID is incomplete." }, { status: 500 });
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cfg.telegramChatId, text: message, disable_web_page_preview: true }) });
      if (!response.ok) throw new Error(`Telegram delivery failed (${response.status})`);
      return NextResponse.json({ ok: true, delivery: "telegram-bot" });
    }

    if (cfg.provider === "whatsapp-cloud") {
      const envName = /^[A-Z][A-Z0-9_]*$/.test(cfg.whatsappTokenEnv || "") ? cfg.whatsappTokenEnv! : "WHATSAPP_ACCESS_TOKEN";
      const token = process.env[envName];
      const version = /^v\d+\.\d+$/.test(cfg.whatsappApiVersion || "") ? cfg.whatsappApiVersion : "v23.0";
      if (!token || !cfg.whatsappPhoneNumberId || !cfg.whatsappRecipient) return NextResponse.json({ ok: false, error: "WhatsApp Cloud token, phone-number ID or recipient is incomplete." }, { status: 500 });
      const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(cfg.whatsappPhoneNumberId)}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: cfg.whatsappRecipient.replace(/[^\d]/g, ""), type: "text", text: { preview_url: false, body: message } }) });
      if (!response.ok) throw new Error(`WhatsApp delivery failed (${response.status})`);
      return NextResponse.json({ ok: true, delivery: "whatsapp-cloud" });
    }

    const defaults = providerDefaults(cfg.provider);
    const host = cfg.host || defaults.host;
    const port = Number(cfg.port || defaults.port);
    const secure = cfg.secure ?? defaults.secure;
    const password = process.env[cfg.passwordEnv || "SMTP_PASS"] || process.env.SMTP_PASS;

    if (!host || !cfg.user || !password || !cfg.to) {
      return NextResponse.json(
        { ok: false, error: "Email delivery is enabled but SMTP host/user/password/to is incomplete." },
        { status: 500 }
      );
    }

    const htmlRows = Object.entries(values)
      .map(([key, value]) => `<tr><th align="left">${escapeHtml(fieldLabel(forms, form.id, key))}</th><td>${escapeHtml(String(value))}</td></tr>`)
      .join("");
    const replyTo = String(values[cfg.replyToField] || "");

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: cfg.user, pass: password },
    });

    await transporter.sendMail({
      from: cfg.from || cfg.user,
      to: cfg.to,
      replyTo: replyTo || undefined,
      subject: `${cfg.subjectPrefix || "Portfolio message"}: ${form.name || form.id}`,
      text: rows,
      html: `<table cellpadding="8" cellspacing="0" border="1">${htmlRows}</table>`,
    });

    return NextResponse.json({ ok: true, delivery: "email" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
