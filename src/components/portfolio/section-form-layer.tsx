"use client";

import { useContent } from "@/lib/content-store";
import { DynamicContactForm } from "./dynamic-contact-form";

export function SectionFormLayer({ sectionId }: { sectionId: string }) {
  const config = useContent((state) => state.content.forms);
  const lang = useContent((state) => state.lang);
  if (!config?.enabled) return null;
  const forms = config.forms.filter((form) => (form.sectionIds ?? []).includes(sectionId));
  if (!forms.length) return null;
  return <div className="relative z-20 mx-auto grid max-w-[var(--cms-max-width)] gap-6 px-5 py-8">{forms.map((form) => <DynamicContactForm key={form.id} config={config} lang={lang} formId={form.id} />)}</div>;
}
