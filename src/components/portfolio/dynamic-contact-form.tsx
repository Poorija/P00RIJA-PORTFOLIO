"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { FormBuilderConfig, FormFieldConfig, FormGraphEdgeConfig, FormStepConfig, Lang } from "@/lib/content-types";
import { useContent } from "@/lib/content-store";
import { deviceForWidth } from "@/lib/responsive-content";

export function DynamicContactForm({
  config,
  lang,
  formId,
}: {
  config: FormBuilderConfig;
  lang: Lang;
  formId?: string;
}) {
  const builder = useContent((state) => state.content.builder);
  const viewportWidth = useContent((state) => state.viewportWidth);
  const device = deviceForWidth(viewportWidth, builder);
  const form = useMemo(
    () => config.forms.find((item) => item.id === (formId || config.activeFormId)) ?? config.forms[0],
    [config.activeFormId, config.forms, formId]
  );
  const startRef = useRef(Date.now());
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [stepId, setStepId] = useState(form?.steps[0]?.id ?? "start");

  if (!config.enabled || !form) return null;

  const steps = form.steps.length ? form.steps : [fallbackStep(lang)];
  const currentStep = steps.find((step) => step.id === stepId) ?? steps[0];
  const visibleFields = form.fields.filter((field) => field.stepId === currentStep.id && shouldShowField(field, values));
  const isMulti = form.layout === "multi" && steps.length > 1;

  const setValue = (field: FormFieldConfig, value: string) => {
    setValues((prev) => ({ ...prev, [field.id]: value }));
  };

  const validateFields = (fields: FormFieldConfig[]) => {
    for (const field of fields) {
      if (!field.required) continue;
      if (!String(values[field.id] ?? "").trim()) {
        toast.error(lang === "fa" ? `فیلد "${field.label}" اجباری است.` : `"${field.label}" is required.`);
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    const allVisible = form.fields.filter((field) => shouldShowField(field, values));
    if (!validateFields(allVisible)) return;
    if (honeypot.trim()) return; // bot trap

    const delivery = config.email;

    /* ---- server-less direct delivery (no mail server / API needed) ----
       The visitor's own WhatsApp / Telegram / mail app sends the composed
       message straight to you — zero server load, works on any host.
       (These are active whenever the provider is selected — the
       `email.enabled` switch only gates server-side SMTP.) */
    if (delivery.provider === "whatsapp-link" || delivery.provider === "telegram-link" || delivery.provider === "mailto") {
      const text =
        `${form.title || form.name}\n\n` +
        allVisible.map((field) => `${field.label}: ${values[field.id] ?? ""}`).join("\n") +
        `\n\n— ${lang === "fa" ? "فرم تماس پورتفولیو" : "Portfolio contact form"}`;
      const subject = `${delivery.subjectPrefix || "Portfolio message"}: ${form.name || form.id}`;

      if (delivery.provider === "whatsapp-link") {
        const phone = (delivery.whatsappPhone || "").replace(/[^\d]/g, "");
        if (!phone) {
          toast.error(lang === "fa" ? "شماره واتس‌اپ تنظیم نشده است." : "WhatsApp number is not configured.");
          return;
        }
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
        toast.success(lang === "fa"
          ? "واتس‌اپ باز شد — فقط دکمه ارسال را بزنید ✅"
          : "WhatsApp opened — just press send ✅");
      } else if (delivery.provider === "telegram-link") {
        const username = (delivery.telegramUsername || "").replace(/^@/, "").trim();
        if (!username) {
          toast.error(lang === "fa" ? "نام کاربری تلگرام تنظیم نشده است." : "Telegram username is not configured.");
          return;
        }
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard may be blocked — user can still type manually */
        }
        window.open(`https://t.me/${username}`, "_blank", "noopener,noreferrer");
        toast.success(lang === "fa"
          ? "تلگرام باز شد و پیام کپی شد — فقط Paste کنید و بفرستید 📋"
          : "Telegram opened and the message is copied — just paste and send 📋");
      } else {
        const to = (delivery.to || "").trim();
        if (!to) {
          toast.error(lang === "fa" ? "آدرس ایمیل مقصد تنظیم نشده است." : "Recipient email is not configured.");
          return;
        }
        const mailLink = document.createElement("a");
        mailLink.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        mailLink.click();
        toast.success(lang === "fa" ? "برنامه ایمیل شما باز شد ✉️" : "Your mail app opened ✉️");
      }

      setValues({});
      setHoneypot("");
      setStepId(steps[0].id);
      startRef.current = Date.now();
      return;
    }

    /* ---- server delivery (SMTP) ---- */
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: form.id,
          lang,
          device,
          values,
          honeypot,
          startedAt: startRef.current,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "send failed");
      toast.success(form.successMessage);
      setValues({});
      setHoneypot("");
      setStepId(steps[0].id);
      startRef.current = Date.now();
    } catch {
      toast.error(form.errorMessage);
    } finally {
      setSending(false);
    }
  };

  const next = async () => {
    if (!validateFields(visibleFields)) return;
    const edge = pickNextEdge(form.edges, currentStep.id, values);
    if (!edge || edge.toStepId === "submit") {
      await submit();
      return;
    }
    setStepId(edge.toStepId);
  };

  const back = () => {
    const index = steps.findIndex((step) => step.id === currentStep.id);
    setStepId(steps[Math.max(0, index - 1)]?.id ?? steps[0].id);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void (isMulti ? next() : submit());
      }}
      className="glass rounded-3xl p-6 md:p-8"
    >
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(event) => setHoneypot(event.target.value)}
        name={config.antiSpam.honeypotField}
        className="pointer-events-none absolute h-px w-px opacity-0"
        aria-hidden
      />

      <div className="mb-5">
        <h3 className="text-lg font-bold text-foreground">{form.title}</h3>
        {form.description && <p className="mt-1 text-xs text-muted-foreground">{form.description}</p>}
      </div>

      {isMulti && (
        <div className="mb-5 flex gap-2">
          {steps.map((step) => (
            <span
              key={step.id}
              className={`h-1.5 flex-1 rounded-full ${step.id === currentStep.id ? "bg-foreground" : "bg-border"}`}
            />
          ))}
        </div>
      )}

      {isMulti && (
        <div className="mb-4 rounded-xl border border-border bg-surface-1 p-3">
          <p className="text-sm font-semibold text-foreground">{currentStep.title}</p>
          {currentStep.description && <p className="mt-1 text-xs text-muted-foreground">{currentStep.description}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleFields.map((field) => (
          <FieldControl
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            lang={lang}
            onChange={(value) => setValue(field, value)}
          />
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        {isMulti && currentStep.id !== steps[0].id && (
          <button
            type="button"
            onClick={back}
            className="rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
          >
            {currentStep.backLabel || (lang === "fa" ? "قبلی" : "Back")}
          </button>
        )}
        <button
          type="submit"
          disabled={sending}
          data-cursor-hover
          className="btn-solid-neutral group relative flex-1 overflow-hidden rounded-xl py-3.5 text-sm font-semibold transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          <span className="relative flex items-center justify-center gap-2">
            {sending ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current"
                />
                {lang === "fa" ? "در حال ارسال..." : "Sending..."}
              </>
            ) : (
              <>
                {isMulti ? currentStep.nextLabel || currentStep.submitLabel : currentStep.submitLabel}
                <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </span>
        </button>
      </div>
    </form>
  );
}

function FieldControl({
  field,
  value,
  lang,
  onChange,
}: {
  field: FormFieldConfig;
  value: string;
  lang: Lang;
  onChange: (value: string) => void;
}) {
  const baseClass =
    "w-full rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-foreground/40";
  const wrapperClass = field.width === "half" ? "" : "sm:col-span-2";

  if (field.type === "textarea") {
    return (
      <label className={wrapperClass}>
        <span className="mb-2 block text-xs text-muted-foreground">{field.label}</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          dir={lang === "fa" ? "rtl" : "ltr"}
          rows={4}
          className={`${baseClass} resize-none`}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className={wrapperClass}>
        <span className="mb-2 block text-xs text-muted-foreground">{field.label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} className={baseClass}>
          <option value="">{field.placeholder || (lang === "fa" ? "انتخاب کنید" : "Choose")}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "radio") {
    return (
      <fieldset className={wrapperClass}>
        <legend className="mb-2 block text-xs text-muted-foreground">{field.label}</legend>
        <div className="flex flex-wrap gap-2">
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm">
              <input type="radio" checked={value === option} onChange={() => onChange(option)} />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className={`${wrapperClass} flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm`}>
        <input type="checkbox" checked={value === "true"} onChange={(event) => onChange(event.target.checked ? "true" : "")} />
        {field.label}
      </label>
    );
  }

  return (
    <label className={wrapperClass}>
      <span className="mb-2 block text-xs text-muted-foreground">{field.label}</span>
      <input
        type={field.type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        dir={field.type === "email" || field.type === "url" || field.type === "tel" ? "ltr" : lang === "fa" ? "rtl" : "ltr"}
        className={baseClass}
      />
    </label>
  );
}

function pickNextEdge(edges: FormGraphEdgeConfig[], stepId: string, values: Record<string, string>) {
  return edges.find((edge) => edge.fromStepId === stepId && edgeMatches(edge, values));
}

function edgeMatches(edge: FormGraphEdgeConfig, values: Record<string, string>) {
  if (edge.operator === "always") return true;
  return compare(values[edge.fieldId] ?? "", edge.operator, edge.value);
}

function shouldShowField(field: FormFieldConfig, values: Record<string, string>) {
  if (!field.showWhenField) return true;
  return compare(values[field.showWhenField] ?? "", field.showWhenOperator, field.showWhenValue);
}

function compare(actual: string, operator: string, expected: string) {
  if (operator === "equals") return actual === expected;
  if (operator === "notEquals") return actual !== expected;
  if (operator === "contains") return actual.includes(expected);
  if (operator === "filled") return actual.trim().length > 0;
  if (operator === "empty") return actual.trim().length === 0;
  return true;
}

function fallbackStep(lang: Lang): FormStepConfig {
  return {
    id: "start",
    title: lang === "fa" ? "فرم" : "Form",
    description: "",
    nextLabel: lang === "fa" ? "بعدی" : "Next",
    backLabel: lang === "fa" ? "قبلی" : "Back",
    submitLabel: lang === "fa" ? "ارسال" : "Submit",
  };
}
