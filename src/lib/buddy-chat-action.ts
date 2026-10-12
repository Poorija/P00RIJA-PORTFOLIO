"use server";

// Server Action for the pixel-buddy chat (called directly from the browser).
// Networking lives in src/lib/ai-providers.ts — FIXED literal public
// endpoints only; the visitor's message is only ever placed in the request
// BODY of those endpoints, never in a URL. The API key is read from
// process.env.AI_API_KEY server-side (like SMTP_PASS) and never reaches the
// browser. The system prompt is built from the site's own content so the
// buddy genuinely answers questions ABOUT the owner.

import { getContent, getContentSection } from "@/lib/content-cache";
import { defaultContentEn } from "@/lib/default-content";
import { callPollinations, chatWithProvider, type Msg } from "@/lib/ai-providers";
import type { AssistantConfig, Lang } from "@/lib/content-types";

const rate = new Map<string, string[]>();

export async function buddyChat(input: { message: string; history?: Msg[]; lang?: string }): Promise<{ ok: boolean; reply?: string; error?: string }> {
  try {
    // In-process sliding-window rate limit: 8 messages / minute / session key.
    const key = input.lang === "fa" || input.lang === "en" ? input.lang : "anon";
    const now = Date.now();
    const window = (rate.get(key) ?? []).filter((t) => now - Number(t) < 60_000);
    if (window.length >= 8) return { ok: false, error: "Too many messages — take a breath! 🎮" };
    window.push(String(now));
    rate.set(key, window);

    const message = String(input.message || "").slice(0, 800).trim();
    if (!message) return { ok: false, error: "Empty message." };
    const history: Msg[] = Array.isArray(input.history)
      ? input.history
          .filter((h) => typeof h?.content === "string")
          .slice(-6)
          .map((h) => ({ role: h.role === "buddy" ? "buddy" : "user", content: String(h.content).slice(0, 800) }))
      : [];
    const lang: Lang = input.lang === "fa" ? "fa" : "en";

    const container = await getContentSection("assistant");
    const cfg = { ...defaultContentEn.assistant, ...((container?.en ?? container?.fa) || {}) } as AssistantConfig;
    if (cfg.enabled === false) return { ok: false, error: "Assistant is off." };

    // The buddy KNOWS the owner: the system prompt is built from site content.
    const content = await getContent();
    const c = content[lang];
    const dev = content.en.developer ?? content.fa.developer;
    const profile = c.profile;
    const skills = (profile?.skills ?? []).map((s) => s.label).slice(0, 12).join(", ");
    const facts = (profile?.facts ?? []).slice(0, 8).map((f) => `${f.key}: ${f.value}`).join("; ");
    const projects = [
      ...(c.graphics?.gallery?.projects ?? []),
      ...(c.security?.gallery?.projects ?? []),
      ...(c.ai?.gallery?.projects ?? []),
    ]
      .slice(0, 8)
      .map((p) => p.title)
      .filter(Boolean)
      .join(", ");
    // Résumé / career timeline — the buddy knows the owner's full history and
    // re-reads it from the CMS on EVERY message, so any site change is picked
    // up automatically.
    const resume = (c.timeline?.entries ?? [])
      .slice(0, 10)
      .map((e) => `${e.date || ""} ${e.title || ""}${e.org ? ` @ ${e.org}` : ""} (${e.kind || "item"}${(e.tags ?? []).length ? `; ${e.tags.join("/")}` : ""})`)
      .join(" | ");
    const languages = (profile?.languages ?? []).map((l) => `${l.name} (${l.level})`).join(", ");
    const stats = (profile?.stats ?? []).map((s) => `${s.value} ${s.label}`).join(", ");
    const socials = (profile?.socials ?? []).map((s) => `${s.label}: ${s.url}`).join(", ");
    const system = `${cfg.persona}

${(cfg.memory || "").trim() ? `OWNER MEMORY — the owner's personal notes (SECOND BRAIN). Highest priority; if anything here conflicts with the site content below, THIS wins:\n---\n${cfg.memory.trim().slice(0, 12000)}\n---` : ""}

ABOUT THE OWNER — the LIVE site content (re-read on every message; use only this, never invent):
Name: ${dev?.name || profile?.name || "P00RIJA"}
Role: ${dev?.role || profile?.role || ""}
Location: ${profile?.location || ""}
Bio: ${(profile?.bio || "").slice(0, 800)}
Stats: ${stats}
Skills: ${skills}
Languages: ${languages}
Facts: ${facts}
Projects: ${projects}
Résumé/timeline: ${resume || "—"}
Contact: ${socials || ""} ${dev?.email ? `Email: ${dev.email}` : ""} ${c.footer?.github ? `GitHub: ${c.footer.github}` : ""} ${c.footer?.linkedin ? `LinkedIn: ${c.footer.linkedin}` : ""}
Answer in the visitor's language. Be complete and precise — if the question deserves a longer answer, give it (structured, friendly), don't cut yourself short.`;

    // ── SMART FALLBACK CHAIN ──
    // Try providers in the CMS-configured priority order. Skip providers
    // marked "down" (quota/timeout) unless their cooldown has expired.
    // On success, mark the provider back up. On failure, mark down + next.
    const { isAvailable, markDown, markUp, parseChain } = await import("@/lib/provider-health");
    // Each provider reads its own key from the server environment.
    const keyFor = (p: string) => p === "groq" ? (process.env.GROQ_API_KEY?.trim() || "") : (process.env.AI_API_KEY?.trim() || "");
    const chain = parseChain(cfg.fallbackChain || cfg.provider);
    const errors: string[] = [];

    for (const providerId of chain) {
      if (!isAvailable(providerId)) {
        errors.push(`${providerId}: cooling down`);
        continue;
      }
      try {
        const reply = providerId === "pollinations"
          ? await callPollinations(system, history, message)
          : await chatWithProvider(providerId, keyFor(providerId), cfg.model, system, history, message);
        markUp(providerId);
        return { ok: true, reply: (reply || "…").slice(0, 2200) };
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown";
        markDown(providerId, reason);
        errors.push(`${providerId}: ${reason.slice(0, 80)}`);
      }
    }
    return { ok: false, error: `All providers failed — ${errors.join(" | ").slice(0, 300)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "AI error" };
  }
}
