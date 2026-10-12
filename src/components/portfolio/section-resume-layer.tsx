"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useContent } from "@/lib/content-store";

export function SectionResumeLayer({ sectionId }: { sectionId: string }) {
  const resumes = useContent((state) => state.content.builder?.sharedResumes ?? []);
  const lang = useContent((state) => state.lang);
  const visible = resumes.filter((resume) => resume.enabled !== false && resume.sectionIds?.includes(sectionId));
  if (!visible.length) return null;
  return <div className="relative z-20 mx-auto grid max-w-[var(--cms-max-width)] gap-4 px-5 py-8 md:grid-cols-2">{visible.map((resume) => <article key={resume.id} className="rounded-2xl border border-border/70 bg-background/60 p-5 backdrop-blur-xl"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--ai-1)]/10 text-[var(--ai-1)]"><FileText className="size-5"/></span><div><p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">{resume.name}</p><h3 className="font-bold">{resume.title}</h3></div></div><p className="mt-4 text-sm leading-7 text-muted-foreground">{resume.summary}</p>{resume.media?.length ? <div className="mt-4 flex gap-2 overflow-x-auto">{resume.media.map((url) => <img key={url} src={url} alt="" loading="lazy" className="h-20 w-28 rounded-lg object-cover"/>)}</div> : null}<div className="mt-4 flex flex-wrap gap-2">{resume.links?.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs hover:bg-surface-1">{link.label || (lang === "fa" ? "باز کردن" : "Open")}<ExternalLink className="size-3"/></a>)}</div></article>)}</div>;
}
