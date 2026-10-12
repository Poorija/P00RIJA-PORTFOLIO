// AI provider adapters for the pixel-buddy chat.
// Every outbound request targets a FIXED literal public https endpoint —
// no caller-controlled URLs exist in this module, so SSRF has nothing to
// redirect. Keys arrive as arguments (read from the server environment only).

export type Msg = { role: string; content: string };
type CompatJson = { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null;

function pickCompat(json: CompatJson, status: number): string {
  if (!json) throw new Error(`AI error ${status}`);
  return String(json?.choices?.[0]?.message?.content || "").slice(0, 900);
}

/** Free provider (default) — no key, fixed literal host. */
export async function callPollinations(system: string, history: Msg[], message: string): Promise<string> {
  const res = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: system },
        ...history.slice(-6).map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: h.content })),
        { role: "user", content: message },
      ],
      model: "openai",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`free AI unavailable (${res.status})`);
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
    return String(json?.choices?.[0]?.message?.content ?? text).slice(0, 900);
  } catch {
    return text.slice(0, 900);
  }
}

export async function callOpenAI(key: string, model: string, system: string, chat: Msg[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || "gpt-4o-mini", messages: [{ role: "system", content: system }, ...chat], max_tokens: 1200 }),
    signal: AbortSignal.timeout(25000),
  });
  return pickCompat(await res.json().catch(() => null) as CompatJson, res.status);
}

export async function callZai(key: string, model: string, system: string, chat: Msg[]): Promise<string> {
  const res = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || "glm-4-flash", messages: [{ role: "system", content: system }, ...chat], max_tokens: 1200 }),
    signal: AbortSignal.timeout(25000),
  });
  return pickCompat(await res.json().catch(() => null) as CompatJson, res.status);
}

export async function callQwen(key: string, model: string, system: string, chat: Msg[]): Promise<string> {
  const res = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || "qwen-turbo", messages: [{ role: "system", content: system }, ...chat], max_tokens: 1200 }),
    signal: AbortSignal.timeout(25000),
  });
  return pickCompat(await res.json().catch(() => null) as CompatJson, res.status);
}

export async function callGroq(key: string, model: string, system: string, chat: Msg[]): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model || "qwen/qwen3.8-27b", messages: [{ role: "system", content: system }, ...chat], max_tokens: 1200 }),
    signal: AbortSignal.timeout(25000),
  });
  return pickCompat(await res.json().catch(() => null) as CompatJson, res.status);
}

export async function callAnthropic(key: string, model: string, system: string, chat: Msg[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: model || "claude-3-5-haiku-latest", max_tokens: 1200, system, messages: chat }),
    signal: AbortSignal.timeout(25000),
  });
  const json = await res.json().catch(() => null) as { content?: { text?: string }[]; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(json?.error?.message || `AI error ${res.status}`);
  return String(json?.content?.[0]?.text || "").slice(0, 900);
}

export async function callGoogle(key: string, model: string, system: string, chat: Msg[]): Promise<string> {
  // Gemini REST — try the requested model, fall back to lower-quota models,
  // then retry transient errors. Free-tier daily limits vary by model
  // (3.8-flash: 20/day, 2.5-flash: ~250/day, 2.5-flash-lite: ~1000/day).
  const models = [model || "gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: chat.map((c) => ({ role: c.role === "assistant" ? "model" : "user", parts: [{ text: c.content }] })),
            generationConfig: { maxOutputTokens: 1200 },
          }),
          signal: AbortSignal.timeout(40000),
        });
        const json = await res.json().catch(() => null) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } } | null;
        if (res.ok && json?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return String(json.candidates[0].content.parts[0].text).slice(0, 2200);
        }
        const msg = json?.error?.message || `HTTP ${res.status}`;
        // quota exhausted → next model
        if (res.status === 429 || msg.includes("quota") || msg.includes("limit")) break;
        // transient (503 high-demand) → retry same model once
        if (res.status === 503 && attempt === 0) { await new Promise((r) => setTimeout(r, 1500)); continue; }
        throw new Error(msg);
      } catch (error) {
        if (attempt === 0 && error instanceof Error && (error.name === "TimeoutError" || error.message.includes("fetch"))) {
          await new Promise((r) => setTimeout(r, 1500)); continue;
        }
        throw error;
      }
    }
  }
  throw new Error("quota exceeded — all Gemini models exhausted");
}

/**
 * Single dispatch entry used by /api/ai/chat. `provider` selects one of the
 * FIXED literal endpoints above; anything unrecognized falls back to OpenAI.
 * The visitor's message/history only ever lands in the request BODY of these
 * public API endpoints — it is never used to build a URL.
 */
export async function chatWithProvider(
  provider: string,
  key: string,
  model: string,
  system: string,
  history: Msg[],
  message: string
): Promise<string> {
  const chat: Msg[] = [
    ...history.slice(-6).map((h) => ({ role: h.role === "buddy" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
  ];
  switch (provider) {
    case "anthropic": return callAnthropic(key, model, system, chat);
    case "google": return callGoogle(key, model, system, chat);
    case "zai": return callZai(key, model, system, chat);
    case "qwen": return callQwen(key, model, system, chat);
    case "groq": return callGroq(key, model, system, chat);
    default: return callOpenAI(key, model, system, chat);
  }
}
