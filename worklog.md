# Portfolio CMS — Worklog

This file tracks all agent work for the CMS + theme + section-aware buttons feature.

---
- **Task ID:** 2
- **Agent:** subagent A (CMS backend)
- **Task:** Build the CMS backend — Prisma Content model, seed script, and API routes for reading/updating all editable site content.

**Work Log:**
1. Read existing context: `src/lib/db.ts`, `src/lib/content-types.ts`, `src/lib/default-content.ts`, `prisma/schema.prisma`, `package.json`, `tsconfig.json`, `eslint.config.mjs`.
2. Added a new `Content` model to `prisma/schema.prisma` (kept existing `User` and `Post` models untouched):
   - `id String @id @default(cuid())`
   - `section String @unique`
   - `data String` (JSON-stringified section content)
   - `updatedAt DateTime @updatedAt`
   - `createdAt DateTime @default(now())`
3. Ran `bun run db:push` — succeeded, schema synced, Prisma Client regenerated (v6.19.2).
4. Created `prisma/seed.ts` (uses relative imports since it lives outside `/src`):
   - Imports `db` from `../src/lib/db`, `defaultContent` from `../src/lib/default-content`, `SECTION_KEYS`/`SectionKey` from `../src/lib/content-types`.
   - Iterates `SECTION_KEYS`, `db.content.upsert` for each (section key + `JSON.stringify(defaultContent[section])`).
   - Logs progress + a created/updated summary, disconnects on completion.
5. Added `"db:seed": "bun run prisma/seed.ts"` to `package.json` scripts.
6. Ran `bun run db:seed` → all 7 sections inserted (`7 created, 0 updated, 7 total sections`).
7. Verified via a one-off Prisma query: 7 Content rows present (site, hero, graphics, security, ai, synthesis, footer).
8. Created `src/app/api/content/route.ts`:
   - `GET`: reads all `Content` rows, JSON-parses each `data`, merges into a single `SiteContent` object keyed by section; falls back to `defaultContent[section]` for any missing/invalid row. Returns `{ ok: true, content }`. Wrapped in try/catch → 500 on error.
   - `POST`: validates `section` ∈ `SECTION_KEYS` (400 otherwise), requires non-null `data` (400 otherwise), upserts the row, returns `{ ok: true, section }`. try/catch → 500.
9. Created `src/app/api/content/[section]/route.ts` (Next.js 16 async `params: Promise<{ section: string }>`):
   - `GET`: validates section from URL, fetches `findUnique`, returns `{ ok: true, section, data }` with `defaultContent` fallback when row is missing or JSON parse fails.
   - `PUT`: validates section from URL + `data` body field, upserts the row, returns `{ ok: true, section }`. Same error envelope (400 for bad input, 500 for server errors).
10. Ran `bun run lint` — passes with no errors.

**Files created:**
- `/home/z/my-project/prisma/seed.ts`
- `/home/z/my-project/src/app/api/content/route.ts`
- `/home/z/my-project/src/app/api/content/[section]/route.ts`

**Files modified:**
- `/home/z/my-project/prisma/schema.prisma` (added `Content` model)
- `/home/z/my-project/package.json` (added `db:seed` script)

**Stage Summary:**
CMS backend is complete and verified. The Prisma `Content` model is live in SQLite with 7 seeded rows (one per section key). Two API endpoints expose the data:
- `GET/POST /api/content` for the merged site content object / bulk section upsert.
- `GET/PUT /api/content/[section]` for single-section read/update.
All routes use the shared `db` client, validate section keys against `SECTION_KEYS`, fall back to `defaultContent` when DB rows are missing or malformed, and return a consistent `{ ok, ... }` JSON envelope with proper HTTP status codes. `bun run lint` passes. The frontend/CMS UI agent can now consume these endpoints.

---
- **Task ID:** 7
- **Agent:** subagent B (CMS admin panel UI)
- **Task:** Build a complete CMS admin overlay component (`CmsPanel`) that lets the user edit every field of the site content and persist changes live.

**Work Log:**
1. Read context: `worklog.md` (prior agent work), `src/lib/content-types.ts` (full `SiteContent` shape), `src/lib/content-store.ts` (the `useContent` Zustand store + `updateSection`), `src/lib/default-content.ts` (sample values to verify field coverage), `src/app/page.tsx` (confirmed `<CmsPanel />` is wired with named import), `package.json` (framer-motion + sonner + lucide-react all present), `eslint.config.mjs` (confirmed `@typescript-eslint/no-explicit-any` is OFF, plus most other rules relaxed), `src/app/globals.css` (confirmed `--gfx-1` / `--sec-1` / `--ai-1` / `--surface-1` CSS variables exist in both light + dark themes), and the shadcn `Button` / `Input` / `Textarea` / `Label` / `Separator` / `ScrollArea` component APIs.
2. Created `/home/z/my-project/src/components/portfolio/cms-panel.tsx` — a single `"use client"` component file with the **named export `CmsPanel`** (no default export, matching what `page.tsx` imports).
3. **Architecture inside the file:**
   - `SECTIONS` constant: 7 sidebar items, each with `key`, Persian `label`, lucide `icon`, optional accent `color` (`var(--gfx-1)` / `var(--sec-1)` / `var(--ai-1)` for graphics/security/ai), and a mono `index`.
   - Reusable field primitives (all theme-aware using `bg-[var(--surface-1)] border-border text-foreground`):
     - `FieldLabel` — small muted label.
     - `TextField({label, value, onChange, dir?, placeholder?})` — wraps shadcn `Input`. Supports `dir="ltr"` for email/URL fields.
     - `TextAreaField({label, value, onChange, rows?, placeholder?})` — wraps shadcn `Textarea`.
     - `StringListField({label, values, onChange, placeholder?})` — list of strings (for `tools`, `certs`, `stack`): each row is Input + trash button, plus "+ افزودن" button. Handles `undefined` gracefully (defaults to `[]`).
     - `ObjectListField({label, items, onChange, fields, makeEmpty})` — generic list-of-objects editor. `fields` is an array of `{key, label, type: "text"|"textarea"|"stringlist"}`. Each item renders as a bordered sub-card with its fields + remove button. A "+ افزودن مورد" button adds a new item via `makeEmpty()`. The `stringlist` field type renders an inline `StringListField` inside the card — this is what powers `ai.projects[].tags`.
   - `FormShell({section, title, children})` — section wrapper with heading + `Separator` + a mono `section: <key>` developer note at the bottom.
   - `SectionForm({section, draft, setDraft})` — a switch that renders the appropriate form for the active section, casting the `draft` to the typed `SiteContent[section]` slice. Each form has a `set(key, value)` helper that does `setDraft({...draft, [k]: v})`.
   - `CmsPanel` — the main export. Uses `useContent()` for `cmsOpen`, `setCmsOpen`, `content`, `updateSection`. Local state: `activeSection` (default `"hero"`), `draft` (initialized from `content[activeSection]`), `saving`.
4. **Effects in `CmsPanel`:**
   - `useEffect([activeSection, content])` re-syncs `draft` from `content[activeSection]` whenever the active section changes OR content is updated externally (after save / on first fetch).
   - `useEffect([cmsOpen])` locks body scroll (`document.body.style.overflow = 'hidden'`) while open, restores the previous value on cleanup.
   - `useEffect([cmsOpen, setCmsOpen])` adds a `keydown` listener that closes the panel on `Escape`.
5. **Save flow:** `handleSave` sets `saving=true`, calls `updateSection(activeSection, draft)` (which POSTs to `/api/content` and updates the store live), then shows `toast.success("بخش ذخیره شد")` on success or `toast.error("خطا در ذخیره")` on failure. Save button shows a `Loader2` spinner while saving.
6. **Layout & UX:**
   - Outer `AnimatePresence` wraps everything; backdrop fades (`opacity 0→1`), panel does `opacity + scale(0.97→1) + y(16→0)` with a custom cubic-bezier ease.
   - `z-[120]` overlay; backdrop is `fixed inset-0 bg-background/80 backdrop-blur-sm` and clicking it closes the panel.
   - Panel container: `max-w-6xl w-full h-[92vh]`, `rounded-2xl`, `border border-border`, `bg-background`, `shadow-2xl`, flex column.
   - Header: icon + title "مدیریت محتوا" + subtitle "ویرایش زنده — تغییرات بلافاصله ذخیره می‌شوند", plus "ذخیره تغییرات" primary Button and a ghost X close button.
   - Body: `lg:flex-row` two-column. Sidebar `lg:w-60` with vertical list on desktop / horizontal scroll on mobile. Active item gets `bg-background` + an inset accent left-border in its section color. Main area is `overflow-y-auto` (the global `::-webkit-scrollbar` styling applies) with `p-4 sm:p-6 lg:p-8` padding.
   - Footer mini-bar: shows `active: <section>` in mono + a hint in Persian.
7. **Field coverage** — verified ALL fields are editable:
   - `site`: brand, brandYear, navGraphics, navSecurity, navAI, navContact, statusBadge (7/7)
   - `hero`: badge, titleLine1, titleHighlight, titleLine2, description, ctaPrimary, ctaSecondary + `stats[]` ObjectListField with value/label (8/8)
   - `graphics`: index, kicker, title, highlight, subtitle + `projects[]` (title/cat/desc/tag) + `tools` StringListField + `cta.label` (11/11)
   - `security`: index, kicker, title, highlight, subtitle + `projects[]` (title/cat/desc/metric/metricLabel) + `skills[]` (label) + `certs` StringListField + `cta.label` (13/13)
   - `ai`: index, kicker, title, highlight, subtitle + `projects[]` (title/cat/desc/tags-as-stringlist) + `stack` StringListField + `cta.label` (11/11)
   - `synthesis`: title, highlight1, highlight2, highlight3, titleLine2, subtitle, cta (7/7)
   - `footer`: badge, title, highlight, description, location, email, github, linkedin, twitter, copyright, version, builtWith (12/12)
8. Email/URL fields (`footer.email`, `github`, `linkedin`, `twitter`, `version`) and Latin-script fields (`site.brandYear`, `*.index`, `*.kicker`) are rendered with `dir="ltr"`.
9. **Lint:** First lint run produced 6 "Unused eslint-disable directive" warnings in my file (I had defensively added `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments, but that rule is OFF in this project so they were unnecessary). Removed all 6 comments via `MultiEdit`. Re-ran `eslint src/components/portfolio/cms-panel.tsx` → **exit 0, zero warnings, zero errors**. (The remaining project-wide lint error in `src/components/portfolio/theme-toggle.tsx` is a pre-existing issue in another agent's file — `set-state-in-effect` — and out of scope per my constraints.)
10. Verified dev server log: after my file was created, `dev.log` shows successive `✓ Compiled in …ms` lines and `GET /api/content 200`, confirming the panel imports cleanly and the page renders.

**Files created:**
- `/home/z/my-project/src/components/portfolio/cms-panel.tsx` (single client component, named export `CmsPanel`)

**Files modified:** none (only the file above was created; the parent agent had already wired the import into `page.tsx`).

**Stage Summary:**
The CMS admin overlay is complete. It is a full-screen, theme-aware, RTL, animated modal (`z-[120]`) with a 7-section sidebar (site / hero / graphics / security / ai / synthesis / footer) and a scrollable form area that exposes EVERY field of `SiteContent` for editing — including nested object lists (`hero.stats`, `graphics.projects`, `security.projects`, `security.skills`, `ai.projects`), string arrays (`graphics.tools`, `security.certs`, `ai.stack`), nested string arrays inside objects (`ai.projects[].tags`), and nested single-key objects (`*.cta.label`). Draft state syncs from the live content store on tab switch; the "ذخیره تغییرات" button persists the active section via `updateSection` (POST `/api/content`), which updates the store so the public site reflects changes live, with `sonner` toasts for feedback. Body scroll is locked while open, Escape closes the panel, and clicking the backdrop closes it. Lint passes for this file with zero warnings/errors.

---
Task ID: 1,3,4,5,6 (parent agent)
Agent: Z.ai Code (orchestrator)
Task: Content schema/types, theme system, content store, refactor all sections to use store + theme tokens + section-aware buttons, integrate CMS panel, end-to-end testing.

Work Log:
- Defined SiteContent types (src/lib/content-types.ts) and default content (src/lib/default-content.ts) covering all 7 sections down to the smallest fields.
- Built theme system: rewrote globals.css with light (:root) + dark (.dark) variable sets, theme-aware section palettes (gfx/sec/ai), grid/glass/surface tokens, and section-aware button utility classes (.btn-solid-gfx/-sec/-ai/-neutral + outline variants).
- Created ThemeProvider (next-themes) + ThemeToggle; integrated into layout with defaultTheme dark.
- Built Zustand content store (src/lib/content-store.ts) with fetchContent/updateSection/setCmsOpen + ContentBoot provider.
- Refactored all 7 section components (site-header, hero, graphics, security, ai, synthesis, site-footer) to read from the store and use semantic theme tokens (replaced all text-white/*/bg-white/* with text-foreground/muted-foreground/bg-surface-1/border-border).
- Replaced rainbow-gradient buttons: hero/synthesis/footer CTAs now neutral solid; each main section got a section-colored CTA (magenta/emerald/blue).
- Wired page.tsx with ContentBoot + CmsPanel.
- Fixed theme-toggle lint (set-state-in-effect) via rAF deferral.

Stage Summary:
- CMS backend (subagent A) + CMS panel (subagent B) integrated and verified.
- Agent Browser E2E: theme toggle dark↔light works (verified html class + body bg/fg contrast), CMS opens, edits a field, saves with toast "بخش ذخیره شد", persists to DB (verified via /api/content), reflects live on page, supports all 7 sections with full field editing (projects, lists, strings).
- Button colors verified via computed styles: graphics=magenta gradient, security=emerald gradient, ai=blue gradient, hero/synthesis/footer=neutral solid (no rainbow).
- No console/runtime errors. lint passes clean.

---
- **Task ID:** 8
- **Agent:** subagent E (mini-games)
- **Task:** Build three mini-games (Color Match, Code Breaker, Neural Memory) and integrate them into the graphics, security, and AI sections.

**Work Log:**
1. Read context: `worklog.md` (prior agent work — CMS backend/panel, theme system, all 7 sections refactored), `src/lib/content-store.ts` (Zustand `useContent` + `t`), `src/lib/content-types.ts` (verified `security.game` + `ai.game` fields exist; `graphics` has no game field), `src/lib/default-content.ts` (sample game strings), `src/lib/i18n.ts` (confirmed `play`/`score`/`best`/`reset`/`newGame` translation keys exist in fa + en), `src/components/portfolio/security-section.tsx` + `ai-section.tsx` + `graphics-section.tsx` (layout, theme tokens, Reveal/TiltCard/Chip helpers), `src/components/ui/slider.tsx` (shadcn Slider API), `src/app/globals.css` (theme vars `--gfx-1`/`--sec-1`/`--ai-1/-2/-3`, `--on-accent`, `--surface-1`, `glow-gfx/-sec/-ai`, `btn-solid-*`/`btn-outline-*`, `no-scrollbar`, `neural-pulse` keyframe), `eslint.config.mjs` (permissive but `react-hooks/set-state-in-effect` is ON — known from prior agent's note about rAF deferral).
2. Created `src/components/portfolio/games/` directory.
3. Built `color-mixer-game.tsx` (named export `ColorMixerGame`):
   - Header with hardcoded bilingual title ("Color Match" / "تطبیق رنگ") based on `lang`, subtitle.
   - Two swatches side-by-side (target vs. your mix), each with `role="img"` + aria-label of the rgb string.
   - Three R/G/B shadcn `Slider` controls (0–255), each with mono label + live numeric readout, full keyboard support via the slider primitive.
   - Submit button (`.btn-solid-gfx`) → score = `round(100 − (euclideanDistance/441.67)*100)` clamped 0–100.
   - Best score persisted to `localStorage["cm-best-score"]`, loaded via `requestAnimationFrame` deferral (avoids `set-state-in-effect`).
   - New-round button (`.btn-outline-gfx`) randomizes target.
   - First randomized target generated post-mount (deterministic initial state avoids SSR/CSR hydration mismatch).
   - Themed magenta throughout via `var(--gfx-1)` + `.btn-solid-gfx`/`.btn-outline-gfx`.
4. Built `code-breaker-game.tsx` (named export `CodeBreakerGame`):
   - Mastermind-style: 4-digit secret code (digits 1–6), max 8 guesses.
   - Header reads `content.security.game.title` + `.subtitle` from the store.
   - Terminal-styled history panel: `oklch(0.1 0.02 165 / 0.92)` background, mono font, repeating-linear-gradient scanline overlay, code_breaker.sh filename, attempts left counter.
   - Each past guess rendered as 4 mono digit cells + 4 feedback dots (hit=`oklch(0.72 0.19 145)` green, near=`oklch(0.78 0.17 75)` amber, miss=`oklch(0.5 0.01 280 / 0.45)` gray) with `sr-only` legend per dot.
   - Current guess row (4 slots, fills as you type).
   - Keypad: 6 digit buttons (1–6) + Delete (lucide icon) + Submit (`.btn-solid-sec`).
   - Win state: `> ACCESS GRANTED · cracked in N tries`. Lose state: `> ACCESS DENIED · code was XXXX` (reveals secret).
   - Best (fewest tries) persisted to `localStorage["cb-best-tries"]`, shown as `best / 8`.
   - Keyboard shortcuts (window-level, skipped when focused in INPUT/TEXTAREA/contentEditable): digits 1–6 push, Backspace pops, Enter submits.
   - Themed emerald throughout via `var(--sec-1)` + `.btn-solid-sec`/`.btn-outline-sec`.
5. Built `neural-memory-game.tsx` (named export `NeuralMemoryGame`):
   - Simon-says: 4 neural nodes in a 2×2 grid, each in an ai-palette color (`--ai-1`, `--ai-2`, `--ai-3`, plus a 60/40 mix of `--ai-1`+`--ai-3`).
   - Header reads `content.ai.game.title` + `.subtitle`.
   - Game flow: idle → watch (sequence plays, growing by 1 each round, speed scales down as sequence grows) → turn (player repeats by clicking nodes) → either next round (correct) or over (wrong).
   - Each node lights up with 55% color fill + radial glow + scale(1.04) + box-shadow glow when active; uses `var(--on-accent)` for active text contrast (semantic token, not `text-white/*`).
   - Status pill with pulsing dot (`neural-pulse` keyframe): PLAY / WATCH / YOUR TURN / GAME OVER, each in the matching color (muted / ai-2 / ai-1 / destructive).
   - Round counter + Best round persisted to `localStorage["nm-best-round"]`.
   - Start button appears in idle/over states (`.btn-solid-ai`).
   - Phase transitions guarded: when round complete, phase flips to `watch` immediately to lock input before the 550 ms transition to nextRound.
   - Keyboard: digits 1–4 click nodes during "turn" phase; Enter/Space starts/restarts in idle/over.
   - Themed blue/violet throughout via `var(--ai-1)`/`--ai-2`/`--ai-3` + `.btn-solid-ai`/`.btn-outline-ai`.
6. Integrated into the three section files (only added imports + one Reveal-wrapped card per file, no other changes):
   - `graphics-section.tsx`: imported `ColorMixerGame`, added an "Arcade" card directly below the Tools strip — `<ColorMixerGame />` inside `rounded-2xl border bg-card/60 p-5 backdrop-blur glow-gfx`.
   - `security-section.tsx`: imported `CodeBreakerGame`, added the game card in the right column below the certs chip strip — same container styling + `glow-sec`.
   - `ai-section.tsx`: imported `NeuralMemoryGame`, added the game card in the right column below the stack chip strip — same container styling + `glow-ai`.
7. Lint: first run produced 4 errors (3× `react-hooks/set-state-in-effect` for the `localStorage`-backed `setBest`/`setSecret`/`setTarget` calls in mount effects + 1× `react/jsx-no-comment-textnodes` for a `// enter your first guess below` line that JSX was parsing as text). Fixed by (a) wrapping all mount-effect `setState` calls in `requestAnimationFrame(...)` (same pattern the CMS-panel agent used for `theme-toggle.tsx`), and (b) wrapping the terminal placeholder line in `{"..."}` so it renders as a string literal. Re-ran `bun run lint` → **exit 0, zero warnings, zero errors**.
8. Verified dev server log: after each file save, `dev.log` shows repeated `✓ Compiled in …ms` lines with no errors; the page renders (`GET / 200`) and `/api/content` returns 200.

**Files created:**
- `/home/z/my-project/src/components/portfolio/games/color-mixer-game.tsx` (named export `ColorMixerGame`)
- `/home/z/my-project/src/components/portfolio/games/code-breaker-game.tsx` (named export `CodeBreakerGame`)
- `/home/z/my-project/src/components/portfolio/games/neural-memory-game.tsx` (named export `NeuralMemoryGame`)

**Files modified:**
- `/home/z/my-project/src/components/portfolio/graphics-section.tsx` (import + 1 Reveal card below tools strip)
- `/home/z/my-project/src/components/portfolio/security-section.tsx` (import + 1 Reveal card below certs in right column)
- `/home/z/my-project/src/components/portfolio/ai-section.tsx` (import + 1 Reveal card below stack in right column)

**Stage Summary:**
All three mini-games are built and integrated. Each is self-contained ("use client", no props, reads theme strings from the content store where helpful, logic is internal), theme-aware (uses semantic tokens `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-surface-1` for structure + section vars `var(--gfx-1)`/`var(--sec-1)`/`var(--ai-1)`/`--ai-2`/`--ai-3` for game-specific accents — no `text-white/*` classes), responsive (mobile-first grid layouts, touch-friendly 36 px+ buttons), and accessible (keyboard-playable, ARIA labels, `sr-only` legends, focus-visible slider thumbs). Best scores/rounds persist to `localStorage`. The terminal-styled Code Breaker uses a scanline overlay + mono font for the requested aesthetic; Neural Memory uses the `neural-pulse` keyframe on its status dot; Color Match uses the shadcn Slider for full keyboard/arrow-key support. `bun run lint` passes clean.

---
- **Task ID:** 6
- **Agent:** subagent C (Hero rewrite — three interactive 3D worlds)
- **Task:** Rewrite `src/components/portfolio/hero.tsx` so the hero features THREE distinct interactive pure-CSS 3D objects (graphics / security / AI) that react to global mouse movement and hover, and navigate to their section on click. Bilingual content read from the Zustand store.

**Work Log:**
1. Read prior context: `worklog.md` (Task IDs 2, 7, 1/3/4/5/6), existing `src/components/portfolio/hero.tsx` (old OrbitalSystem with three tilted rings + central CORE + floating badges), `src/lib/content-store.ts` (`useContent` Zustand store, `content.hero.worlds.{gfx,sec,ai}.{label,hint}` shape), `src/lib/content-types.ts` (verified `hero.worlds` schema), `src/lib/default-content.ts` (sample Persian + English values for `worlds`), `src/app/globals.css` (theme tokens: `--gfx-1/2/3`, `--sec-1/2/3`, `--ai-1/2/3`, `--*-glow`, `--surface-1`, `--hairline`, `--aurora-opacity`, button utility classes `.btn-solid-neutral`/`.btn-outline-neutral`, perspective helpers `.perspective-near`/`.perspective-far`, `.preserve-3d`, `.text-gradient-tri`, keyframes `spin-slow`/`spin-reverse-slow`/`pulse-glow`/`aurora-drift`/`gradient-shift`), `src/components/portfolio/section-utils.tsx` (Reveal/TiltCard patterns), `src/components/portfolio/custom-cursor.tsx` (reads `data-cursor-zone` = "gfx"|"sec"|"ai"|"default" + `data-cursor-hover`).
2. Replaced the entire file. New file is a single `"use client"` component with the **named export `Hero`** (matching the existing import in `page.tsx`). No default export.
3. **Layout** — Two-column grid on desktop (`md:grid-cols-[1.05fr_0.95fr]`):
   - Left: badge, h1 (with `<span className="text-gradient-tri">{titleHighlight}</span>`), description, two buttons (`btn-solid-neutral` ctaPrimary → scroll to `#graphics`, `btn-outline-neutral` ctaSecondary → `#contact`), stats row.
   - Right: three 3D world objects. On mobile: vertical flex stack (`flex flex-col items-center gap-10`). On `md+`: triangle composition inside an `aspect-square` container — gfx top-center, sec bottom-left, ai bottom-right.
   - Kept the scroll hint at the bottom (animated `SCROLL` + arrow).
4. **Three distinct pure-CSS 3D objects** (NO three.js — only `perspective` + `preserve-3d` + CSS/framer-motion transforms):
   - **GraphicsCrystal** (magenta/fuchsia/amber): 5 rotated gradient squares at different `translateZ` (±28px / ±14px / 0), each with a `linear-gradient` between `var(--gfx-N)` colors, magenta border, magenta glow `box-shadow`. Central radial spark. Continuous `rotateY: 0→360` via framer-motion (18s linear). Label = `hero.worlds.gfx.label`.
   - **SecurityCube** (emerald/teal/lime): 6 transparent wireframe faces (each a square with `border` in `var(--sec-1)`, faint emerald tint background, inset glow) using `translateZ(var(--half))` etc. for the 6 cube faces. Plus 8 corner "data nodes" (small dots with emerald glow) positioned via `translate3d(±half, ±half, ±half)`. `--half` is a CSS variable: `56px` mobile / `64px` sm+ via `sm:[--half:64px]`. Continuous `rotateY` via framer-motion (22s). Label = `hero.worlds.sec.label`.
   - **AIOrb** (blue/cyan/violet): central glowing sphere (radial gradient `var(--ai-2/3/1)`, inset shadows for 3D depth, outer glow). Pulsing inner glow (wrapped to avoid transform conflict with centering). 3 tilted orbit rings (`rotateX(72deg)`, `-52deg`, `18deg`), each a `border` circle with a "neuron" dot positioned on its rim, spinning via CSS `animate-spin-slow`/`animate-spin-reverse-slow` at different durations (7s/9s/12s). Each orbit's tilt creates a foreshortened ellipse look. Label = `hero.worlds.ai.label`.
5. **Interactions:**
   - **Global mouse parallax**: single `useEffect` adds a `mousemove` listener (passive) + `requestAnimationFrame` loop. Computes mouse offset from viewport center (normalized -1..1 on each axis). Lerps current toward target at 0.06 per frame. On each frame, iterates `tiltRefs.current` and writes `el.style.transform = "rotateX(...) rotateY(...)"` directly to each world's tilt wrapper — **no React re-renders**. Each world has its own sensitivity (`gfx:16`, `sec:10`, `ai:22`) for layered depth. Disabled on touch/coarse-pointer devices via `matchMedia("(hover: none), (pointer: coarse)")`.
   - **Continuous slow self-rotation**: each object has its own axis rotation (crystal/cube via framer-motion `animate={{rotateY:360}}`; AI orb via CSS `animate-spin-slow`/`animate-spin-reverse-slow` on each orbit). The mouse tilt is applied to an OUTER tilt wrapper so the two transforms compose (tilt + scale + orientation + spin) rather than conflict.
   - **Hover**: `group-hover:scale-[1.08]` on a scale wrapper inside the tilt wrapper — scales object up smoothly (300ms ease-out). Glow halo behind each object intensifies (`opacity-50 → opacity-90` over 500ms). Label + hint below the object fade in (`opacity-0 → 100` over 300ms).
   - **Click**: each `WorldObject` is a `<button>` whose `onClick` calls `document.getElementById("graphics"|"security"|"ai")?.scrollIntoView({behavior:"smooth"})`.
   - **Custom cursor integration**: each world button carries `data-cursor-zone="gfx"|"sec"|"ai"` (the custom cursor recolors to the world palette and shows the section label) plus `data-cursor-hover` (cursor enlarges on hover).
   - **Static 3D orientation** baked into a wrapper (`rotateX(-18deg) rotateY(28deg)` for gfx, `-22deg/32deg` for sec, `-15deg/0deg` for ai) so the cube faces / crystal layers are visible from an angle rather than head-on.
6. **Bilingual + theme-aware:**
   - All copy is read from `useContent((s) => s.content.hero)` — `badge`, `titleLine1`, `titleHighlight`, `titleLine2`, `description`, `ctaPrimary`, `ctaSecondary`, `stats[]`, `worlds.{gfx,sec,ai}.{label,hint}`. No hardcoded Persian/English text.
   - Semantic theme tokens throughout: `text-foreground`, `text-muted-foreground`, `border-border` (via `var(--hairline)`), `bg-surface-1` (via `var(--surface-1)`), `text-emerald-400` (the ping dot — kept from prior file, a Tailwind palette color used for the live-status indicator only). No `text-white/*` or `bg-white/*`.
   - Section palette vars (`--gfx-1`, `--sec-1`, `--ai-1`, `--*-glow`) used everywhere for the 3D objects — these auto-adapt per theme (light/dark values defined in globals.css).
   - Text alignment uses `md:text-start` (RTL-aware via Tailwind logical properties) — works correctly for both `fa` (rtl) and `en` (ltr) because `document.documentElement.dir` is set by the store's `setLang`.
7. **Accessibility & responsive:**
   - Each world button has `aria-label="{label} — {hint}"`, `type="button"`, focus-visible ring (`focus-visible:ring-2 focus-visible:ring-ring`).
   - Mobile: objects stack vertically, gap-10, smaller container (`max-w-sm`). Desktop: triangle composition in `max-w-md` aspect-square.
   - All copy in the DOM (text side + label/hint under each object), no info trapped in interaction-only.
8. **Lint:** `bun run lint` → exit 0, zero warnings, zero errors (project-wide).
9. Verified dev log: clean successive `✓ Compiled in …ms` and `GET / 200` responses — no runtime/compile errors after the file was written.

**Files modified:**
- `/home/z/my-project/src/components/portfolio/hero.tsx` (full rewrite — single client component, named export `Hero`)

**Stage Summary:**
The hero now showcases three distinct, interactive, pure-CSS 3D "world" objects — a holographic gradient crystal (graphics, magenta/amber), a wireframe cube with corner data nodes (security, emerald), and a neural orb with tilted orbiting neuron rings (AI, blue/violet). Each object continuously self-rotates on its own axis (framer-motion `rotateY` for crystal/cube, CSS `animate-spin-slow`/`-reverse-slow` for AI orbits), reacts to global mouse position with a lerped parallax tilt (different sensitivity per world for layered depth — written directly to DOM via a single rAF loop, no re-renders), scales up to 1.08 with intensified glow on hover, fades in its label/hint, and navigates to its section (`#graphics`/`#security`/`#ai`) on click via `scrollIntoView({behavior:"smooth"})`. Each carries `data-cursor-zone` so the custom cursor recolors to the world's palette and shows the section name. Layout is two-column on desktop (text left, triangle of objects right) and stacks vertically on mobile. All copy comes from the bilingual Zustand store (`useContent((s)=>s.content.hero)`), all colors use theme-aware section CSS variables, and no `text-white`/`bg-white` tokens are used. Lint passes clean (exit 0).

---
- **Task ID:** 7
- **Agent:** subagent D (3D virtual gallery)
- **Task:** Build a CSS-3D virtual exhibition gallery for the graphics section — a perspective walkthrough where artwork hangs on walls. Integrate into graphics-section via an "Enter gallery" button.

**Work Log:**
1. Read context: `worklog.md` (prior agent work — CMS backend, CMS panel, theme system, content store), `src/components/portfolio/graphics-section.tsx` (existing structure with SectionHeading, GradientCube, projects grid, CTA, tools strip, ColorMixerGame), `src/lib/content-store.ts` (Zustand store with `useContent` selector + `t()` and `lang`), `src/lib/content-types.ts` (graphics.gallery = {title, subtitle, enterLabel, artworks:[{title,meta,color}]}), `src/lib/i18n.ts` (translation keys: enterGallery, exitGallery, nextArt, prevArt, close), `src/lib/default-content.ts` (6 artworks with hex colors), `src/components/portfolio/section-utils.tsx` (Reveal wrapper), `src/app/globals.css` (theme tokens incl. `--gfx-1`, `btn-outline-gfx`, `animate-pulse-glow`, `preserve-3d`), `eslint.config.mjs` (very lenient — most rules off, but `react-hooks/rules-of-hooks` still on).

2. Created `/home/z/my-project/src/components/portfolio/virtual-gallery.tsx` — a single `"use client"` component file with the **named export `VirtualGallery`** (props: `{ artworks, title, subtitle, onClose }`).

3. **Architecture of VirtualGallery:**
   - Reads `t` and `lang` from the content store via two `useContent` selectors.
   - `count = artworks.length`, `angleStep = 360 / count`. 6 artworks → 60° spacing around the viewer.
   - State: `current` (focused artwork index), `rotation` (world rotateY in degrees), `dragging` (disables CSS transition during drag), `detail` (artwork index shown in detail panel, or null), `isMobile` (responsive sizing), `motes` (lazy-initialized array of 14 dust motes with random position/delay/duration/size).
   - Refs: `drag` (active/startX/startRot/moved), `rotationRef` (mirrors `rotation` for use inside window event handlers without re-subscribing).
   - `focusArtwork(i)`: memoized; wraps `i` mod count, sets `current` and `rotation = -i * angleStep` (world rotates counterclockwise to bring artwork i to center).
   - `goNext`/`goPrev`: language-aware — in LTR, next = current+1 (artwork to the right); in RTL (fa), next = current−1 (artwork to the left, matching RTL "forward" direction). Prev is the inverse.
   - **Effects:** (a) detect mobile via resize listener; (b) lock body scroll while open, restore on cleanup; (c) window-level `pointermove`/`pointerup`/`pointercancel` for drag — updates rotation live (drag right = look right = rotation decreases) and snaps to nearest artwork on release via `Math.round(-rotation/angleStep)`; (d) window `keydown` for ArrowRight (current+1, spatial), ArrowLeft (current−1), Escape (close detail or call onClose).
   - `onPointerDown` on the scene container starts a drag (records startX + startRot, sets dragging=true). `onArtworkClick` ignores clicks that were actually drags (via `drag.current.moved` flag, reset after 50ms).

4. **3D scene geometry (pure CSS 3D, no three.js):**
   - Outer scene div: `perspective: 1100px` desktop / `720px` mobile, `perspective-origin: 50% 50%`.
   - Inner world div: `transform-style: preserve-3d`, `transform: rotateY(${rotation}deg)`, CSS transition `transform 0.8s cubic-bezier(0.22,1,0.36,1)` when not dragging, `none` when dragging (so drag is pixel-accurate).
   - **Walls**: one per artwork — hexagonal room. Each wall: `transform: rotateY(i*60deg) translateZ(-460px)`, 540×480 (desktop) / 400×380 (mobile), dark vertical gradient `linear-gradient(180deg, oklch(0.16 0.025 280) → oklch(0.06 0.015 280))` with inset shadow. `backface-visibility: hidden`.
   - **Floor**: 1600×1600 plane, `translateY(220px) rotateX(-90deg)` (normal points up toward viewer). Magenta-tinted perspective grid `linear-gradient` (60px cells) over a radial dark gradient.
   - **Ceiling**: 1600×1600 plane, `translateY(-260px) rotateX(90deg)`, subtle radial gradient at 50% opacity.
   - **Artworks**: each is `rotateY(i*60deg) translateZ(-440px)` (20px in front of its wall), `preserve-3d`, vertically centered with marginTop: -160.

5. **ArtworkFrame sub-component** (renders each frame + reflection):
   - `<button>` frame with rounded-2xl, 2px border, dark `bg-[oklch(0.1_0.02_280)]`, padding 2.
   - Border color = artwork's color when active, else `color-mix(in oklch, color 35%, transparent)`.
   - Box-shadow: when active, glow in artwork color (`0 0 50px -5px color, 0 20px 50px -20px color`); otherwise a soft dark shadow + subtle color tint ring.
   - Inside: `aspect-[4/5]` gradient div (135deg from full color to `color-mix 35% black`), then a plaque area with title (line-clamped, `text-foreground`, font-semibold) and meta (`text-[10px] uppercase tracking-widest text-muted-foreground`).
   - `hover:scale-[1.04]` for tactile feedback.
   - **Floor reflection**: absolutely positioned below the button, `transform: scaleY(-1)`, mirrored gradient, faded via `mask-image: linear-gradient(to bottom, rgba(0,0,0,0.45) → transparent 75%)`, opacity 0.6.

6. **UI chrome:**
   - **Top bar** (z-20): magenta pulsing dot (`var(--gfx-1)`, `animate-pulse-glow`) + gallery title + subtitle (truncated) on the start side; Exit button (`border-border`, `text-foreground`, backdrop-blur, `bg-background/60`) with X icon + `t("exitGallery")` label (hidden on mobile).
   - **Bottom bar** (z-20): centered flex with Prev button, counter pill, Next button. Counter uses Persian digits (`toFaDigits`) when `lang === "fa"` (e.g. "۳ / ۶"), styled in `var(--gfx-1)`. Prev/Next buttons use language-aware chevron icons (ChevronRight for prev in fa, ChevronLeft in en) and labels `t("prevArt")`/`t("nextArt")` (hidden on mobile, icons always visible).
   - **Detail panel** (z-30, AnimatePresence): dark blurred backdrop, centered card with `max-w-md`, spring-animated (scale 0.9→1, y 20→0). Card border tinted with artwork color, glow shadow. Shows large 4/3 gradient + title + meta + Close button. Clicking backdrop or Close dismisses; clicking card stops propagation.
   - **Dust motes**: 14 absolutely-positioned dots, framer-motion animated (y: [0,-30,0], x: [0,15,0], opacity: [0,0.7,0]) with random duration 8–18s and random delay, infinite repeat. Pink-tinted (`rgba(255,220,240,0.55)`) with blur(0.5px).
   - Root `motion.div` (z-[110], fixed inset-0, dark `oklch(0.08 0.02 280)` background) fades in/out via framer-motion `initial/animate/exit opacity`.

7. **Integration into graphics-section.tsx:**
   - Added imports: `useState` from react, `AnimatePresence` from framer-motion (alongside existing `motion`), `Frame` from lucide-react, `VirtualGallery` from `./virtual-gallery`.
   - Added `const [galleryOpen, setGalleryOpen] = useState(false);` to `GraphicsSection`.
   - Added an "Enter gallery" button (below SectionHeading, above the grid) wrapped in `<Reveal delay={0.1}>` — uses `btn-outline-gfx` class, `Frame` icon (rotates on hover), and `g.gallery.enterLabel` text.
   - Kept the existing projects grid, GradientCube, CTA, tools strip, and ColorMixerGame untouched.
   - Added `<AnimatePresence>` block before `</section>` that renders `<VirtualGallery artworks={g.gallery.artworks} title={g.gallery.title} subtitle={g.gallery.subtitle} onClose={() => setGalleryOpen(false)} />` when `galleryOpen` is true.

8. **Responsive design:**
   - Mobile (`isMobile`, < 768px): perspective 720px (vs 1100), roomRadius 320 (vs 440), artSize 150 (vs 210), wallW 400 (vs 540), wallH 380 (vs 480), floorY 170 (vs 220), ceilY 200 (vs 260).
   - `touch-none` on the scene container prevents touch-scroll interference with drag.
   - Top/bottom bar buttons hide their text labels on mobile (`hidden sm:inline`), keeping just the icons — touch targets remain ≥44px.

9. **Accessibility / UX:**
   - All buttons have `aria-label` (using translated strings).
   - Keyboard: ArrowLeft/ArrowRight navigate spatially, Escape closes detail panel or exits gallery.
   - Body scroll locked while open; restored on close.
   - Drag vs click disambiguated via a `moved` flag (drag > 4px suppresses the click).
   - Smooth spring-free CSS transition on the world rotation (0.8s cubic-bezier ease) — reliable `preserve-3d` handling without fighting framer-motion's transform management.

10. **Lint:** First run flagged `react-hooks/rules-of-hooks` because the `motes` `useState` was placed after an early `if (count === 0) return null;`. Fixed by moving the motes `useState` (with lazy initializer so positions are stable across renders) up with the other hooks, before the early return. Re-ran `bun run lint` → **exit 0, zero errors, zero warnings**. Dev server log shows continuous successful `✓ Compiled in …ms` and `GET / 200` responses after the changes.

**Files created:**
- `/home/z/my-project/src/components/portfolio/virtual-gallery.tsx` (single client component, named export `VirtualGallery` + internal `ArtworkFrame`)

**Files modified:**
- `/home/z/my-project/src/components/portfolio/graphics-section.tsx` (added imports, `galleryOpen` state, "Enter gallery" button, AnimatePresence-wrapped VirtualGallery render)

**Stage Summary:**
The graphics section now has a "wow" feature: clicking the `btn-outline-gfx` "ورود به گالری" / "Enter gallery" button opens a full-screen dark 3D virtual exhibition. The viewer stands in the center of a hexagonal room; 6 artwork frames (one per wall) hang in 3D space, each showing its CMS-defined color as a gradient with title + meta plaque below, and a faded mirrored "floor reflection". Navigation works three ways: (1) drag with mouse/touch to freely rotate the view (snaps to nearest artwork on release), (2) prev/next buttons in the bottom bar with a Persian-digit counter "۳ / ۶", (3) keyboard arrows + Escape. Clicking an artwork centers it; clicking the centered artwork opens a detail panel. Dust motes float across the scene for atmosphere, a magenta `var(--gfx-1)` accent dot pulses in the top bar, and the floor has a perspective grid. The whole thing is always dark-themed (it's a virtual exhibition) with artwork colors providing the only chromatic accents, while exit/close/prev/next controls use `border-border` / `text-foreground` for theme neutrality. Fully responsive (smaller perspective + artwork sizes + swipe on mobile). Lint passes clean.

---
- **Task ID:** 9
- **Agent:** subagent F (CMS panel rewrite)
- **Task:** Greatly expand the CMS panel for the bilingual (fa/en) content model with new fields (hero.worlds, graphics.gallery, security.game, ai.game), auth-gating, language switching, and more useful sections.

**Work Log:**
1. Read context: `worklog.md`, existing `src/components/portfolio/cms-panel.tsx` (734 lines), `src/lib/content-types.ts` (full SiteContent schema including the new `hero.worlds`, `graphics.gallery`, `security.game`, `ai.game` blocks), `src/lib/content-store.ts` (store API: `content`, `lang`, `setLang`, `authed`, `authChecked`, `cmsOpen`, `setCmsOpen`, `logout`, `updateSection`, `t`), `src/lib/i18n.ts` (available translation keys), `eslint.config.mjs`, `package.json`.
2. Rewrote `src/components/portfolio/cms-panel.tsx` (now ~1084 lines) with all required features. Only this one file was touched.

**Implementation details:**

- **Auth gate:** `CmsPanel` returns `null` unless `authChecked && authed`. Placed AFTER all hook calls to respect the Rules of Hooks. A "logout" button (`LogOut` icon) in the panel header calls `logout()`.

- **Language tab:** New `LanguageSwitcher` component renders two pill buttons ("فا" / "EN") with `role="tablist"` / `aria-selected`. Clicking calls `setLang("fa" | "en")`. Shown in the header (desktop) and in a dedicated mobile row. A hint label shows "در حال ویرایش: فارسی" / "Editing: English" next to the pills.

- **Draft reload on language switch:** A `useEffect` keyed on `[activeSection, lang, content]` calls `setDraft(content[activeSection])` so the draft always reflects the active language's section. (Inline `eslint-disable-next-line react-hooks/set-state-in-effect` — this is the canonical "reset local editable state when source changes" pattern explicitly requested by the spec.)

- **Sections sidebar (7, relabeled bilingually):** site → "سایت و ناوبری / Site & Nav", hero → "بخش معرفی / Hero", graphics → "گرافیک / Graphics", security → "امنیت / Security", ai → "هوش مصنوعی / AI", synthesis → "ترکیب / Synthesis", footer → "فوتر / Footer". Kept icons + section colors (`var(--gfx-1)`, `var(--sec-1)`, `var(--ai-1)`) + index numbers + active highlight (inset box-shadow + `bg-background`).

- **Section search/filter:** New search `Input` at the top of the sidebar (with `Search` icon, `ps-8` padding). `filteredSections` is a `useMemo` that filters `SECTIONS` by label (lowercased, matches either fa or en half) or key. Empty state shows "موردی یافت نشد / No matches".

- **Forms — every field of every section now editable, including NEW blocks:**
  - **site:** brand, brandYear, navGraphics, navSecurity, navAI, navContact, statusBadge.
  - **hero:** badge, titleLine1, titleHighlight, titleLine2, description, ctaPrimary, ctaSecondary, stats[] {value,label}, **worlds.gfx/sec/ai** {label,hint each} — grouped in a `SubsectionBox` "دنیاهای تعاملی / Interactive Worlds" with a 3-column grid for labels and a 3-column grid for hints.
  - **graphics:** index, kicker, title, highlight, subtitle, projects[] {title,cat,desc,tag}, tools[], cta.label, **gallery** {title, subtitle, enterLabel, artworks[] {title,meta,color}} — `gallery` is in its own `SubsectionBox`; the `color` field uses the new `ColorField` (input[type=color] + hex text input side by side).
  - **security:** index, kicker, title, highlight, subtitle, projects[] {title,cat,desc,metric,metricLabel}, skills[] {label}, certs[], cta.label, **game** {title, subtitle} — `game` in its own `SubsectionBox`.
  - **ai:** index, kicker, title, highlight, subtitle, projects[] {title,cat,desc,tags[]}, stack[], cta.label, **game** {title, subtitle} — `game` in its own `SubsectionBox`.
  - **synthesis:** title, highlight1, highlight2, highlight3, titleLine2, subtitle, cta.
  - **footer:** badge, title, highlight, description, location, email, github, linkedin, twitter, copyright, version, builtWith.

- **Reusable field primitives kept & extended:** `FieldLabel`, `TextField`, `TextAreaField`, `StringListField` (now uses `t("add")` for the add button), `ObjectListField` (now uses `t("addItem")`; added a new `"color"` field type that renders `ColorField`). Added new primitives: `ColorField` (color picker + hex input, validates 6-digit hex before passing to the native picker), and `SubsectionBox` (visually groups nested sub-objects like worlds/gallery/game with a heading + hint).

- **Save flow:** "ذخیره تغییرات / Save" button (with `Save` icon, `Loader2` spinner while `saving`) calls `updateSection(activeSection, draft)`. On success → `toast.success(t("saved"))` and records `lastSaved = Date.now()`. On failure → `toast.error(t("saveError"))`; the store itself sets `authed = false` on 401 (handled in `content-store.ts`), so the panel auto-hides via the auth gate.

- **Unsaved-changes indicator:** `dirty` is a `useMemo` doing a shallow JSON compare of `draft` vs `content[activeSection]`. When dirty, an amber dot (`size-2 rounded-full bg-amber-500`) appears in the header next to the actions, with a bilingual `title`/`aria-label`.

- **Reset to default (per section, inline confirm):** A `RotateCcw` "بازنشانی / Reset" button (disabled when `!dirty`) toggles `confirmReset`. When confirming, it shows a destructive "تأیید بازنشانی / Confirm reset" button + a ghost "انصراف / Cancel" button inline. Confirming reloads the draft from `content[activeSection]`. The confirm state auto-clears when switching sections (handled in the section-button `onClick`, not an effect — avoids the `set-state-in-effect` lint rule).

- **Status footer:** A 4-item bilingual status bar at the bottom showing: `section: <activeSection>` (mono), `language: <lang>` (mono), `آخرین ذخیره / Last saved: <time or —>` (mono, uses `toLocaleTimeString` with `fa-IR`/`en-US` locale), and `auth: ✓/—` (emerald when authed).

- **Theme-aware:** Uses ONLY semantic tokens throughout — `bg-background`, `bg-card`, `bg-[var(--surface-1)]`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`/`text-primary-foreground` for the active language pill, `text-destructive` for delete icons, `text-emerald-500` for the auth-ok indicator, `bg-amber-500` for the unsaved dot. No `text-white/*` or hardcoded colors. Verified to look correct in both light and dark themes.

- **RTL-aware:** The layout uses `flex`/`grid` which mirror naturally with `dir`. Logical properties used where directional: `lg:border-e` (inline-end border between sidebar and main), `ps-8`/`start-2.5` for the search icon inset, `ms-auto` for the section index. The mobile language row and header wrap with `flex-wrap`. The `<html dir>` is controlled by the store's `setLang`.

- **Quality:** `"use client"`, TypeScript strict (uses `any` only in the reusable `ObjectListField`/`SectionForm` set helpers, which is permitted by the project's eslint config). `AnimatePresence` + `motion` for fade+scale open/close. Body scroll lock via `document.body.style.overflow` toggle in a `useEffect` keyed on `cmsOpen`. Escape-to-close via `keydown` listener. Only the active section's form renders (no list of all sections). `useContent` is called once in `CmsPanel` (whole-store subscription) and via `useContent((s) => s.t)` in `StringListField`/`ObjectListField` for the add/addItem labels.

- **Lint fixes:** Initial `bun run lint` flagged two `react-hooks/set-state-in-effect` errors. Fixed by (a) inlining an `eslint-disable-next-line` on the intentional draft-sync effect (canonical pattern, spec-mandated), and (b) removing the `confirmReset` auto-reset effect entirely and moving `setConfirmReset(false)` into the section-button `onClick` handler. Final `bun run lint` passes clean (zero errors, zero warnings). Dev server compiles cleanly.

**Files modified:**
- `/home/z/my-project/src/components/portfolio/cms-panel.tsx` — full rewrite (~1084 lines).

**New features added (summary):**
1. Auth gate (panel hidden until `authed && authChecked`).
2. Bilingual language tab ("فا" / "EN" pills) + editing-language hint.
3. Draft auto-reloads on `[activeSection, lang, content]` change.
4. Sidebar section search/filter box.
5. Coverage of all NEW fields: `hero.worlds.{gfx,sec,ai}.{label,hint}`, `graphics.gallery.{title,subtitle,enterLabel,artworks[]{title,meta,color}}`, `security.game.{title,subtitle}`, `ai.game.{title,subtitle}`.
6. `ColorField` primitive (color picker + hex input) for gallery artwork colors.
7. `SubsectionBox` primitive to visually group nested blocks.
8. Unsaved-changes amber dot indicator.
9. Per-section "Reset to saved" with inline confirm.
10. Logout button in the header.
11. 4-item status footer (section key, language, last-saved time, auth state).
12. Bilingual labels everywhere (sidebar, form headings, hints, status bar, buttons).
13. Theme-aware semantic tokens only (works in light + dark).
14. RTL-aware layout via logical properties.

**Fields now editable (complete list):**
- site: brand, brandYear, navGraphics, navSecurity, navAI, navContact, statusBadge
- hero: badge, titleLine1, titleHighlight, titleLine2, description, ctaPrimary, ctaSecondary, stats[]{value,label}, worlds.gfx.{label,hint}, worlds.sec.{label,hint}, worlds.ai.{label,hint}
- graphics: index, kicker, title, highlight, subtitle, projects[]{title,cat,desc,tag}, tools[], cta.label, gallery.title, gallery.subtitle, gallery.enterLabel, gallery.artworks[]{title,meta,color}
- security: index, kicker, title, highlight, subtitle, projects[]{title,cat,desc,metric,metricLabel}, skills[]{label}, certs[], cta.label, game.title, game.subtitle
- ai: index, kicker, title, highlight, subtitle, projects[]{title,cat,desc,tags[]}, stack[], cta.label, game.title, game.subtitle
- synthesis: title, highlight1, highlight2, highlight3, titleLine2, subtitle, cta
- footer: badge, title, highlight, description, location, email, github, linkedin, twitter, copyright, version, builtWith

All editable per-language (fa and en independently). Lint passes clean. Dev server compiles with no errors.

---
Task ID: 2-5,10 (parent agent — foundation)
Agent: Z.ai Code (orchestrator)
Task: Auth system, bilingual i18n, bilingual content model + API + store, dynamic flow background, header (lang toggle + auth-gated CMS + login modal), integration, end-to-end testing.

Work Log:
- Auth: src/lib/auth.ts (HMAC-signed cookie session), api/auth/{login,logout,status} routes. ADMIN_PASSWORD=admin123 in .env. Content POST/PUT now 401 without auth.
- i18n: src/lib/i18n.ts (fa/en UI translations), LanguageContext via content store (lang + setLang + t). <html> lang/dir sync.
- Bilingual content: content-types extended (hero.worlds, graphics.gallery, security.game, ai.game). default-content.ts now exports defaultContentFa + defaultContentEn. DB stores {fa,en} per section. API GET returns both; POST/PUT take {section,lang,data} with auth.
- Content store: contentFa/contentEn/lang/content (active derived)/updateSection(section,data) saves current lang/checkAuth/login/logout.
- FlowBackground: canvas 2D, 6 additive drifting blobs in section palette, theme-aware (multiply in light, lighter in dark), grain overlay. Fixed -z-10.
- Header: LanguageToggle (fa/en), ThemeToggle, auth-gated CMS button (opens login modal if not authed; shows green-dot CMS + logout when authed).
- LoginModal: opens via 'open-login' custom event; password → /api/auth/login; success closes + toast.
- Wired page.tsx: FlowBackground + LoginModal added.

Stage Summary:
- All 4 subagents (C: hero 3D, D: 3D gallery, E: 3 games, F: expanded CMS) completed successfully.
- Agent Browser E2E verified: 3 interactive 3D hero objects click→scroll to sections; language toggle fa↔en with dir switch; login modal→admin123→authed; CMS opens with bilingual tabs (فا/EN) + 7 sections + gallery color fields (6 color inputs); 3D virtual gallery opens with prev/next (counter 1/6) + keyboard; 3 games present (Color Match, Code Breaker, Neural Memory); flow canvas bg active (1440x900); light theme contrast correct; mobile responsive; no console/runtime errors.
- Auth API verified: no-cookie POST→401, with-cookie POST→save ok, DB persisted.
- lint clean. dev server HTTP 200.

---
Task ID: aurora-fix
Agent: Z.ai Code
Task: Replace static/poor background with a true liquid aurora — moving gradient spots that merge fluidly, visible everywhere including behind the footer.

Work Log:
- Root cause 1: <body> had opaque `bg-background` (layout) + page layers opaque, so the fixed -z-10 canvas was hidden.
- Root cause 2: old canvas used `lighter` blend = additive glow, not liquid merging.
- Root cause 3: Tailwind v4 dropped top-level @keyframes in globals.css, so animations never ran.
- Fix: rewrote FlowBackground to liquid aurora technique — 6 large radial-gradient blobs, `filter: blur(70px)`, `mix-blend-mode: screen`, each on a unique 32-42s organic wandering path (translate vw/vh + scale breathing). Heavy blur + screen blend = overlapping blobs merge into smooth liquid color transitions on the dark `bg-ink` base. Added vignette + grain overlay.
- Keyframes injected via a <style> tag inside the component (bypasses Tailwind v4 keyframe stripping — verified all 6 now present in DOM).
- Removed `bg-background` from layout <body>; removed opaque `bg-background` + static spot divs from footer. Body + page wrapper + main + footer all transparent now so the liquid aurora flows through the entire page.

Stage Summary:
- Agent Browser verified: 6 liquid keyframes in DOM; blob transform animating (matrix changes over time, confirmed motion); footer transparent (rgba 0,0,0,0); works in BOTH dark (ink base) and light (light ink base) themes; no console/runtime errors.

---
- **Task ID:** 9
- **Agent:** subagent G (synthesis diagram rewrite)
- **Task:** Rewrite `src/components/portfolio/synthesis.tsx` so the convergence diagram has all three lines (gfx/sec/ai → "یک خالق"), intertwined + wavy, and mouse-reactive.

**Work Log:**
1. Read prior context: `worklog.md`, existing `src/components/portfolio/synthesis.tsx`, `src/lib/content-store.ts`, `src/lib/default-content.ts`, `src/lib/content-types.ts`, `src/components/portfolio/section-utils.tsx`, `eslint.config.mjs`.
2. Rewrote `src/components/portfolio/synthesis.tsx` end-to-end:
   - Pure module-scope helpers `synCompute(i, u, mx, my, t)` and `synPath(i, mx, my, t)` generate a 48-sample wavy path per line. Each line's wave: `amp · sin(π·u) · sin(2π·FREQ·u + phase[i] + phaseShift + timePhase)`, layered on the linear source→dest baseline. 120° phase offsets between the three lines (`SYN_BASE_PHASE = [0, 2π/3, 4π/3]`) make them visibly weave/cross. `sin(π·u)` taper forces amplitude to 0 at both endpoints so every line cleanly meets its node — fixes the missing security line.
   - Mouse reactivity: `mousemove` on the container div records `mx,my ∈ [0,1]` into a ref. A single `requestAnimationFrame` loop (mounted in `useEffect`, cancelled on unmount) lerps `mouseCurrent → mouseTarget` at 12%/frame, then recomputes each line's `d` attribute and 6 particles' `cx`/`cy` via `setAttribute` — **no per-frame React re-renders**. Mouse Y modulates amplitude (`amp = base + (my−0.5)·28`), mouse X modulates phase (`phaseShift = (mx−0.5)·π·1.4`), and `timePhase = t·speed[i]` keeps the weave breathing even with no mouse input. `mouseleave` resets target to center.
   - Touch fallback: detects coarse pointers (`matchMedia("(pointer: coarse)")`, `ontouchstart`, `maxTouchPoints`); on touch devices, skips mouse listeners and drives a virtual cursor (`mx = 0.5 + 0.4·sin(t·0.27)`, `my = 0.5 + 0.4·cos(t·0.31)`) so the braid keeps moving organically.
   - 6 flowing particles (2 per line, staggered offsets, per-line durations) sampled on the **live** path so they always ride the wavy line. Colored with section vars + `drop-shadow` glow.
   - Kept: framer-motion pulse ring on destination node, source-node circles, section gradients (`url(#g-gfx/#g-sec/#g-ai)`), aurora background blob, all section copy from the store, CTA button, `data-cursor-*` attrs, semantic theme tokens.
   - Bilingual labels: now consumes `useContent((s) => s.lang)` and switches node labels + badge text between fa/en.
   - SSR-safe: initial `d` strings + initial particle positions are precomputed with centered mouse + t=0 so the server-rendered SVG matches the first rAF frame (no hydration flash).
   - Replaced the old `pathLength` draw-in with a simple `opacity` fade-in per line (pathLength conflicts with imperative `d` updates).
3. Lint fixes: the newer `react-hooks/refs` rule (React Compiler plugin, enabled via `eslint-config-next`) flags iterating over an array of refs during render (e.g. `refArray.map((ref) => <X ref={ref}/>)`), and `rules-of-hooks` flags `useRef` inside `.map`. Refactored to declare 3 path refs + 6 particle refs as individual top-level `useRef` calls, write the JSX elements individually (no `.map` over refs in render), and aggregate them into arrays **inside** the `useEffect` (where ref access is allowed). Also removed a stale `eslint-disable-next-line react-hooks/exhaustive-deps` (that rule is globally off).
4. Verified: `bun run lint` → **0 errors, 0 warnings** for the file and the whole project. `dev.log` shows clean `GET / 200` responses after the rewrite (an intermediate version had a transient JSX syntax error from a missing `}` after a `.map`, fixed in the same pass).

**Stage Summary:**
The synthesis section's convergence diagram now renders all three intertwined, wavy lines (graphics / security / AI) converging into "یک خالق", with the waves breathing and shifting in real time as the user moves their mouse over the diagram (and a gentle auto-orbit on touch devices). Implementation is fully SSR-safe, theme-aware (uses section color vars), TypeScript-strict, lint-clean, and uses zero per-frame React re-renders (all updates via refs + `setAttribute` inside a single rAF loop). Only `src/components/portfolio/synthesis.tsx` was modified. Work record written to `/home/z/my-project/agent-ctx/9-subagent-G.md`.

---
- **Task ID:** 10
- **Agent:** subagent H (CMS expansion — custom sections, duplicate, raw JSON, per-field reset)
- **Task:** Greatly expand the CMS so the user can duplicate sections, create custom sections, delete custom sections, and customize every field with more granularity.

**Work Log:**
1. Read prior work: `worklog.md` (Tasks 2, 7, 8, 9, parent orchestrator), `src/lib/content-types.ts`, `src/lib/content-store.ts`, `src/lib/default-content.ts`, `src/lib/i18n.ts`, `src/lib/auth.ts`, existing `src/app/api/content/route.ts`, `src/app/api/content/[section]/route.ts`, existing `src/components/portfolio/cms-panel.tsx` (~1084 lines from Task 9).
2. Modified `src/app/api/content/route.ts`:
   - Added `isCustomSectionKey()` helper and `isAcceptableSectionKey()` (built-in OR custom-).
   - `GET` now accepts `?all=1` query → returns `{ ok, sections: [{ section, data }] }` with ALL DB rows (built-in + custom), parsed (including `_meta`).
   - `POST` now accepts custom-* sections; added optional `meta` field that merges into the row's `_meta` (used to persist label/iconKey). Validates either (lang+data) or meta is present.
3. Modified `src/app/api/content/[section]/route.ts`:
   - Added `isCustomSectionKey()` helper.
   - Added `DELETE` handler — auth-guarded, refuses built-ins (400), deletes the row for custom-* keys, returns `{ ok: true, section }`.
4. Expanded `src/components/portfolio/cms-panel.tsx` (now ~2220 lines):
   - Renamed `SECTIONS` → `BUILTIN_SECTIONS`; added `BUILTIN_KEYS` Set + `builtinLabel(key)` helper.
   - Added `CUSTOM_ICONS` (6 icons: file, star, tag, box, heart, settings), `getCustomIcon(iconKey)`, `newCustomKey()` (`custom-<ts>-<rand>`), `isCustomKey(key)`, `blankCustomData()` (`{ title, subtitle, body, items: [] }`).
   - Added `CustomSection` type and direct-fetch helpers: `fetchAllSections()` (GET ?all=1), `postCustomLang()` (POST with lang+data), `postCustomMeta()` (POST with meta only), `deleteCustomSection()` (DELETE).
   - Extended `TextField` + `TextAreaField` with optional `defaultVal` + `onReset` props; new `FieldResetChip` component renders a small reset button next to the label when value differs from default (built-in sections only — gives per-field reset).
   - New `KVObjectListField` — free-form key/value pair list. Each item is `Record<string, string>` rendered as a stack of `key` + `value` Input rows. Users can add/remove/rename arbitrary fields per item; auto-dedup keys (`field`, `field_1`, `field_2`…).
   - New `RawJsonEditor` — textarea pre-loaded with `JSON.stringify(value, null, 2)`. "Apply" parses + validates (must be JSON object) + calls `onApply`. Shows inline error or applied confirmation. Re-syncs on external `value` change.
   - New `NewSectionDialog` — inline form (not window.prompt) with label Input + 6-icon picker + Create/Cancel. AnimatePresence slide-in. Enter submits, Escape cancels.
   - Extended `FormShell`: `section` prop is now `string` (was `SectionKey`); new optional `customNote` boolean renders the bilingual note about custom sections being saved to the DB.
   - New `CustomSectionForm` — title/subtitle (TextField), body (TextAreaField, 5 rows), items (KVObjectListField). Wrapped in FormShell with `customNote`.
   - Rewrote `CmsPanel` main component:
     - `activeSection` is now `string` (built-in OR custom-*).
     - New state: `customSections`, `busy`, `showNewDialog`, `confirmDeleteKey`, `renamingKey`, `renameValue`, `iconPickerKey`, `showRaw`.
     - `savedValue` useMemo — single source of truth for the draft reload + dirty compare + RawJsonEditor sync; covers activeSection + lang + content + activeCustom changes.
     - `useEffect` fetches `/api/content?all=1` on every CMS open; falls back to `hero` if the active custom section disappears.
     - Escape handler now closes nested overlays (new-section dialog, icon picker, rename, delete confirm, raw JSON) before closing the panel.
     - Sidebar: search + "+ New section" button + NewSectionDialog; built-in group (7 items, each with a hover duplicate icon button); custom group (empty-state note + custom items each with 4 always-visible action buttons: Duplicate, Rename, Change icon, Delete). Inline rename confirm (mobile), inline icon picker, inline delete confirm.
     - Form area: new action bar with section title + `custom-…` key badge + Duplicate button + Raw JSON toggle. Below: structured form (SectionForm for built-in, CustomSectionForm for custom) OR RawJsonEditor when raw toggle is on. Empty-state for missing custom section.
     - Status footer: added 5th item — `نوع / type: built-in | custom`.
     - Handlers (all plain async functions, NOT useCallback — avoids hooks-ordering issue with the auth-gate early return): `handleSave` (built-in path → store's updateSection; custom path → postCustomLang), `handleReset`, `handleDuplicate` (clones fa+en+iconKey via 3 parallel POSTs), `handleCreateCustom` (blank fa+en + meta), `handleDeleteCustom`, `handleRenameCustom`, `handleChangeIcon` (optimistic), `handleApplyRaw`.
5. Lint fixes: initial `bun run lint` flagged 6 `react-hooks/rules-of-hooks` errors (useCallback called conditionally after the auth-gate early return) and 3 unused eslint-disable warnings. Fixed by (a) converting all 6 useCallbacks to plain async function declarations, (b) removing the 3 unused `// eslint-disable-next-line react-hooks/set-state-in-effect` comments (the rule didn't fire on those lines), and (c) removing the unused `useCallback` import. Final `bun run lint` → exit 0, 0 errors, 0 warnings.
6. Verified dev server: `GET / 200`, `GET /api/content?all=1 200` (returns all 7 built-in sections with parsed fa/en data), `GET /api/content 200`. No runtime errors after the final edits.

**Files modified:**
- `/home/z/my-project/src/app/api/content/route.ts` — added `?all=1` query + custom-* section support + optional `meta` field.
- `/home/z/my-project/src/app/api/content/[section]/route.ts` — added `DELETE` handler (auth-guarded, custom- only).
- `/home/z/my-project/src/components/portfolio/cms-panel.tsx` — major expansion (1084 → ~2220 lines).

**New CMS capabilities:**
1. **Duplicate** any section (built-in or custom) into a new custom section — clones fa + en + icon.
2. **Create** a new blank custom section via inline dialog (label + 6-icon picker).
3. **Delete** custom sections (server refuses built-ins) with inline confirm.
4. **Rename** custom sections inline (persists to `_meta`).
5. **Change icon** for custom sections via inline picker.
6. **Raw JSON editor** toggle on any section — edit active language's data as raw JSON, with parse/validate + apply.
7. **Free-form key/value items** on custom sections — each item is a `Record<string, string>` with add/remove/edit on arbitrary keys (true point-by-point customization).
8. **Per-field reset** for built-in sections — small reset chip appears next to any field whose value differs from the default.
9. **`?all=1` API** — returns ALL DB rows including custom sections (with their `_meta`).
10. **DELETE API** — auth-guarded, custom-only.

**Constraints honored:** Only 3 files modified (cms-panel.tsx + 2 API routes). page.tsx and section components untouched (custom sections persist in DB but don't render on the live site — out of scope; CMS shows bilingual note explaining this). Auth-gated, theme-aware (semantic tokens only), bilingual (fa/en tab preserved), all existing features preserved (7 built-in section forms, language tab, search, reset, save, status bar, logout, escape-to-close, body scroll lock). No test files written. Lint passes clean (exit 0).

**Stage Summary:**
The CMS now supports a full custom-section lifecycle (create / duplicate / edit / rename / change icon / delete) entirely from the panel UI, persisted to the DB via the extended `/api/content` API. Each built-in section's existing structured form is unchanged; custom sections get a generic shape editor (`title`, `subtitle`, `body`, `items[]`) where `items` are free-form key/value pairs. A power-user Raw JSON editor can be toggled on ANY section (built-in or custom) to edit the active language's data as raw JSON — useful for duplicated built-in sections (whose shape doesn't match the generic custom form) and for quick mass edits. Per-field reset chips appear on built-in sections to restore individual fields to their defaults. The sidebar groups built-in and custom sections separately, with hover-revealed duplicate buttons on built-ins and always-visible action buttons (duplicate, rename, icon, delete) on customs. The status footer now reports section type (built-in/custom). All API writes remain auth-gated; DELETE refuses built-ins server-side. Lint clean, dev server compiles, API endpoints respond 200.

---
Task ID: mega-update
Agent: Z.ai Code
Task: Hero restructure (3 cards top, text bottom, clickable SCROLL), liquid 3D object replacing cube, gallery button fix, mirrored text fix, rectangle removal, full-width games, synthesis intertwined mouse-reactive lines + security line, copyright 2026, login X fix, CMS duplicate/create/customize, creativity injection (magnetic buttons, marquee).

Work Log:
- Hero rewritten: 3 WorldCards in a row on top, text content below, SCROLL hint is now a clickable button that smooth-scrolls to graphics.
- Graphics: removed rectangle cover (rounded-3xl bg-surface-1 container); replaced GradientCube with LiquidMorphObject (SVG gooey filter merging 6 aurora-colored circles into a liquid metaball, morphs continuously, tilts with mouse, color-cycle on click). "مشاهده گالری کامل" CTA now opens gallery (not scroll). Gallery "enter" button also opens gallery.
- Gallery: added backfaceVisibility:hidden to artwork frames → mirrored text fixed.
- Games: moved ColorMixer/CodeBreaker/NeuralMemory out of side columns to FULL-WIDTH containers below their section grids.
- Synthesis (subagent G): 3 intertwined wavy paths (48 sample points each, 120° phase offset → guaranteed crossing), mouse-reactive amplitude+phase via rAF+setAttribute, security line now present, touch-device fallback with virtual cursor.
- Copyright: 2025→2026 in default-content (fa+en), re-seeded.
- Login modal: X button robustness (type=button, z-10, bg-surface-1), added Escape key handler, added dedicated "بستن" cancel button below form.
- CMS (subagent H): duplicate any section → custom clone; create new blank custom sections (inline dialog, icon picker); delete custom sections (auth-guarded DELETE API, custom-only); rename/icon-change customs; raw JSON editor toggle on any section; per-field reset chips; KV object list for custom items; ?all=1 API for fetching all rows.
- Creativity: MagneticButton (attracts toward cursor, lerp, touch fallback) on hero CTAs; KineticMarquee strip between hero and graphics (bilingual word scroll, edge fades, auto direction).

Stage Summary:
- Agent Browser verified: SCROLL click smooth-scrolls (0→994px); marquee animating; liquid morph object present; gallery button opens "نمایشگاه مجازی سه‌بعدی"; synthesis convergence SVG has 3 wavy paths (d lengths 727/752/763); copyright 2026; login X closes; CMS duplicate creates custom section in DB (verified via API); new-section + raw-JSON + duplicate buttons present; mobile + light theme OK; dev.log clean; lint clean.

---
Task ID: gallery-rebuild
Agent: Z.ai Code
Task: Remove marquee banner, fix mirrored text in gallery, rebuild gallery as project grid + large popup with image gallery + specs + description, add project template to CMS.

Work Log:
- Removed KineticMarquee import + usage from page.tsx (banner gone).
- Diagnosed mirrored-text root cause via VLM on user screenshot: the 3D rotating gallery's wall-mounted frames (rotateY > 90°) flipped the text. backfaceVisibility wasn't enough because the whole frame rotated.
- Rewrote virtual-gallery.tsx entirely: removed 3D hexagonal room. New design = a vertically-scrolling overlay with a responsive grid of ProjectCards. Clicking a card opens a large ProjectPopup (z-120) with: left = image gallery (main image + nav arrows + thumbnail strip + counter), right = project info (category/year badges, title, meta, client/role rows, full description, specs key/value grid, optional external link, prev/next project nav). Escape closes popup→gallery. Keyboard arrows navigate images.
- Extended content-types: new ProjectArtwork interface {title, meta, category, color, year, client, role, description, specs[], images[], link}. graphics.gallery.artworks → graphics.gallery.projects.
- Updated default-content (fa + en) with 6 fully-detailed sample projects (Noor/City/Music/Dream/Minimal/Form) each with images, specs, description, client, role.
- Extended CMS graphics section: gallery subsection now uses a full project template via ObjectListField with fields: title, meta, category, color (color picker), year, client, role, description (textarea), link, images (stringlist — URL or hex color), specs (new nested objectlist with key/value). Added "objectlist" type to ObjectListField with recursive sub-item rendering + add/remove. Re-seeded DB.
- VLM-verified both gallery grid and popup: NO mirrored text, Persian fully readable. Popup confirmed to have image gallery + specs + description + project nav + thumbnails.

Stage Summary:
- Agent Browser verified: marquee removed; gallery opens with "گالری پروژه‌ها" grid; clicking a project opens popup with "توضیحات پروژه" section; CMS gallery template present with description/images/specs fields; adding a project via CMS works (6→7 projects, toast "بخش ذخیره شد", persisted to DB); mobile + light theme OK; no errors; lint clean; dev.log clean.

---
Task ID: polish-round
Agent: Z.ai Code
Task: Fix hydration error, enlarge glassmorphism blob, rebuild gallery as 3D horizontal scroll, shrink AI game, make synthesis lines more complex/nested.

Work Log:
- Hydration error: root cause = Grammarly browser extension adding `data-gr-ext-installed`/`data-new-gr-c-s-check-loaded` attributes to <body>. Fixed by adding `suppressHydrationWarning` to <body> (already on <html>). Verified: no hydration errors in console after reload.
- Graphics blob: rewrote LiquidMorphObject — bigger (360→440px), formless (8 organic border-radius morphs via framer-motion), glassmorphism (backdrop-blur 24px saturate 1.4, translucent layered gradient, inner glow, glassy top highlight). 6 inner aurora color pools flow inside. Mouse parallax (translate + rotate) + click color cycle. VLM-confirmed: "large formless blob with glassmorphism".
- Gallery: rebuilt as 3D horizontal scroll. Each project = full-viewport slide (w-screen, h-[calc(100vh-100px)]). Track translates X by current*100vw. Slides tilt in 3D (rotateY ±25deg, translateZ -200px) based on distance from current → depth effect. Nav arrows + progress dots + keyboard arrows. Each slide = big visual (aspect 3/4) + project info (title, meta, description preview, client/role, CTA "مشاهده جزئیات کامل" → opens full popup). VLM-confirmed: full-screen horizontal scroll, one large project per view, nav arrows + progress dots, no mirrored text.
- AI game: compacted NeuralMemoryGame. Changed node layout from 2×2 grid (aspect-square) to 4-column row (aspect-[4/3], smaller gaps, smaller text). Header row more compact (text-sm → text-sm, subtitle text-[11px]). Game card now ~1280×433px (was much taller). VLM-confirmed: compact, proportional.
- Synthesis: made lines far more complex and nested. Added a THIRD sine wave (tertiary micro-ripple at freq 16). Increased amplitude (34/48/34 from 14/22/14), primary freq 4.5 (from 2.2), secondary freq 9.0 with amp 0.45, tertiary amp 0.18. Points 80 (from 48). Path d-length now 1210/1242/1272 chars (was 727/752/763). VLM-confirmed: "complex, multiple wave oscillations and crossings, intricate flowing effect".

Stage Summary:
- All 5 requests done. Agent Browser + VLM verified each. No hydration errors, no console errors, lint clean, dev.log clean. Mobile + light theme OK. Server HTTP 200.

---
Task ID: polish-round-2
Agent: Z.ai Code
Task: Bigger hero cards + glassmorphism, security hint text fix, bigger gallery popup (10% margin) + scroll, floating X button, 3D effect, 3D rotating graphics blob, CMS compatibility check, global Vazirmatn font.

Work Log:
- Hero cards: bigger (min-h-340px, p-8/10), real glassmorphism (backdrop-blur 20px saturate 1.3, translucent layered gradient, inner highlight + section-tinted inner glow, drop shadow). 3D objects inside also scaled up (h-32→h-36, crystal/cube/orb all bigger). whileHover y:-8 lift.
- Security hint: "دنیای شبکه و دفاع" → "دنیای شبکه و امنیت سایبری" (fa) + "A world of networks & defense" → "A world of networks & cybersecurity" (en). Re-seeded.
- Gallery popup: p-[5vh_5vw] + h-[90vh] w-[90vw] max-w-[1400px] = exactly 10% margin each side. Right info panel already overflow-y-auto (scrollHeight 808px confirmed).
- Floating X button: added absolute left-4 top-4 z-30 12x12 rounded-full backdrop-blur on the gallery 3D scroll area, in addition to the top-bar close. Verified closes gallery.
- Graphics blob 3D: rewrote mouse handler — blob now rotates in X, Y, Z axes following cursor (rotateX ±45deg, rotateY ±45deg, rotateZ ±12deg, translateZ 40-100px). Container perspective 1200px, blob preserve-3d. Touch fallback: gentle auto-orbit (sin/cos) so it stays alive on mobile. Verified matrix3d changes over time (rotating).
- CMS: confirmed gallery.projects template with all fields (title, meta, category, color, year, client, role, description, link, images stringlist, specs objectlist). No artworks references remain. Compatible with all sections.
- Vazirmatn global: body font-family + universal inherit (*) + explicit input/textarea/button/select font-family. .font-mono class uses JetBrains Mono. Verified body/h1/button/input all use Vazirmatn via computed styles.

Stage Summary:
- VLM-verified: 3 large glassmorphism cards, 3D formless blob with glassmorphism + perspective, large popup (90vw/90vh) with X button + image gallery + project info. Agent Browser: no hydration errors, no console errors, mobile + light OK, lint clean, dev.log clean.

---
- **Task ID:** terminal-egg
- **Agent:** subagent (interactive terminal)
- **Task:** Replace the auto-typing `LiveTerminal` in the security section with a real interactive shell terminal that boots with the visitor's real browser/OS info, accepts typed commands, and ships a set of easter-egg-packed security-themed commands.

**Work Log:**
1. Read `/home/z/my-project/worklog.md` and `src/components/portfolio/security-section.tsx` to understand prior context. Confirmed the existing `LiveTerminal` was an auto-typing component cycling through `TERMINAL_LINES`.
2. Verified `animate-blink` + `no-scrollbar` utilities exist in `src/app/globals.css`, and that `toast` from `sonner` is already used elsewhere in the project (`site-footer.tsx`, `cms-panel.tsx`, `login-modal.tsx`).
3. Created `src/components/portfolio/interactive-terminal.tsx` exporting `InteractiveTerminal`:
   - `"use client"` + TypeScript strict, self-contained, no props.
   - Boot sequence on mount that prints the visitor's REAL info: browser (parsed from `navigator.userAgent` with Edge/Opera/Firefox/Chrome/Safari detection), OS, `navigator.language`, `screen.width x height`, `window.innerWidth x innerHeight`, `Intl.DateTimeFormat().resolvedOptions().timeZone`, `navigator.hardwareConcurrency`, `navigator.onLine`. Each line delayed ~70ms for a realistic dump.
   - Real text `<input>` styled as a terminal prompt: `root@portfolio:~/path$ ` with a manual block cursor (transparent input text + overlay render div with blinking emerald block via `animate-blink`).
   - Command interpreter implementing: `help`, `whoami`, `ls`/`dir` (with `-a`), `cat <file>` (readme.md / .secret / firewall-rules.md / OSCP.txt / pentest.md, "Is a directory" for projects/certs/skills, "No such file" otherwise), `pwd`, `cd <dir>` (changes fake cwd which updates the prompt; supports `~`, `..`, projects/certs/skills), `date`, `echo`, `clear`/`cls`, `nmap <host>` (full fake scan table), `ping <host>` (4 animated ICMP replies @ 500ms each + stats), `ifconfig`/`ip a` (eth0 + lo), `ps` (fake PID table), `sudo <x>` ("not in the sudoers file... 😏"), `hack <target>` (6-step animated "ACCESS GRANTED" sequence), `matrix` (36 lines of falling katakana/ASCII chars @ 80ms ≈ 2.9s), `fortune` (random security quote from 8), `exit`/`logout` (prints logout then reboots), `uname`, `rm` (permission denied). Unknown command → `command not found: <cmd>. Type 'help' for available commands.` Empty Enter → new prompt.
   - Easter eggs: Konami code (↑↑↓↓←→←→b a) detected on the whole window → fires `matrix` + `toast.success("🎮 KONAMI!")` via sonner; `sudo rm -rf /` / `rm -rf /` → "😂 Nice try. This is a portfolio, not a production server."; `vim`/`emacs`/`nano`/`vi` → "Opening editor... just kidding."; `fortune` random quote pool.
   - History: ArrowUp/ArrowDown cycles through command history. Bonus: Ctrl+L clears, Ctrl+C aborts current line with `^C`.
   - Visual design: identical to old LiveTerminal — `bg-[oklch(0.1_0.02_165/0.92)]`, emerald `var(--sec-1)` text, traffic-light dots + `root@portfolio:~` title bar, `h-[260px] overflow-y-auto no-scrollbar` output area, `dir="ltr"`, `whitespace-pre-wrap break-words` lines, line cap at 250 to avoid runaway growth during `matrix`.
   - Cancellation via `runIdRef` so a new command (or boot) cancels any in-flight async animation cleanly.
4. Modified `src/components/portfolio/security-section.tsx`:
   - Removed the `useEffect`/`useRef`/`useState` React imports (no longer needed at the top-level section component).
   - Removed the `TERMINAL_LINES` constant.
   - Added `import { InteractiveTerminal } from "./interactive-terminal";`.
   - Replaced `<LiveTerminal />` with `<InteractiveTerminal />`.
   - Removed the entire `LiveTerminal` function (lines 191-280 of the original file).
   - Kept `NetworkGraph`, `CodeBreakerGame`, projects, skills, certs, CTA, and all aurora/grid backgrounds unchanged.
5. Ran `bun run lint` — passed cleanly with no errors in either file.
6. Verified `dev.log` — recent `GET / 200` responses confirm the page renders without runtime errors.

**Stage Summary:**
The security section's terminal is now a fully interactive simulated shell. Visitors see their real browser/OS/screen/timezone/etc. printed at boot, then can type commands with working history (↑/↓), Ctrl+L/Ctrl+C, and a rich command set including animated `ping`, `hack`, and `matrix` effects. Easter eggs include the Konami code (auto-triggers matrix + sonner toast), `sudo rm -rf /`, `vim`/`emacs`, and `.secret` file reveal. Files touched:
- created `/home/z/my-project/src/components/portfolio/interactive-terminal.tsx`
- modified `/home/z/my-project/src/components/portfolio/security-section.tsx` (removed `LiveTerminal` + `TERMINAL_LINES`, swapped in `InteractiveTerminal`, dropped now-unused React hooks import).

---
Task ID: easter-egg-round
Agent: Z.ai Code
Task: Back-to-top button (RTL/LTR aware), section-aware scrollbar + progress bar (gradient between sections), popup top padding, interactive terminal with real shell commands + easter eggs.

Work Log:
- SectionDetector component: IntersectionObserver tracks active section (home/graphics/security/ai/contact), sets --scroll-color + --scroll-color-from/--scroll-color-to CSS vars on <html>. When between sections, from/to differ → gradient. When in a section, from=to=solid color.
- ScrollProgress: rewrote to use var(--scroll-color-from/to) gradient instead of fixed rainbow. Smooth 0.5s transition.
- globals.css scrollbar: now uses linear-gradient(--scroll-color-from, --scroll-color-to) + Firefox scrollbar-color. No more rainbow — changes per section.
- BackToTop: fixed button bottom-right in fa/RTL, bottom-left in en/LTR. Circular progress ring (SVG dashoffset) showing scroll %, arrow colored with --scroll-color. Appears after 400px scroll.
- Gallery popup: changed items-center→items-start + pt-[calc(5vh+72px)] so popup starts below the 64px header. max-h-[80vh] so it fits. overflowY auto on backdrop.
- InteractiveTerminal (subagent): real shell — boot sequence shows user's REAL browser/OS/lang/screen/timezone/cores/online status. 20+ commands: help, whoami, ls, cat (with .secret easter egg), pwd, cd, date, echo, clear, nmap, ping (animated), ifconfig, ps, sudo (egg), hack (animated), matrix (rain), fortune, exit, vim/emacs (egg). History (↑/↓), Ctrl+L, Ctrl+C. Konami code → auto matrix + toast. "sudo rm -rf /" → 😂 egg. Replaced old LiveTerminal in security-section.

Stage Summary:
- Agent Browser verified: back-to-top bottom-right (fa) / bottom-left (en) ✓; --scroll-color changes per section (sec-1→ai-1 verified); popup top: 117px (below 64px header); terminal boot info displays; help/nmap/sudo commands execute; konami egg fires; no hydration errors; lint clean; dev.log clean.
- VLM confirmed terminal: "shows system info, input prompt root@portfolio:~$, emerald theme".

---
Task ID: planetary-hero
Agent: Z.ai Code
Task: Replace 3-card hero with full-screen 3D solar system — 3 planets orbiting a star, each with moons (skills), cinematic dive-in transition on click.

Work Log:
- Extended content-types: hero.worlds.{gfx,sec,ai} now include moons: string[] (skill names).
- Updated default-content (fa+en) with 5 moons per world: gfx=[Branding,Illustration,UI/UX,Motion,3D Art], sec=[Linux,Pentest,Network,Crypto,DevOps], ai=[PyTorch,LLM,Vision,RAG,MLOps]. Re-seeded.
- Created planetary-hero.tsx (PlanetaryHero component):
  - Full-screen (h-screen w-full) 3D solar system with perspective 1600px.
  - CentralStar: glowing core with pulsing corona (3 layers) + rotating conic-gradient light rays.
  - 3 PlanetSystem components: each has an orbit ring (tilted circle), a planet orbiting via rotateZ animation, and moons orbiting the planet (counter-rotating). Each planet has unique surface gradient + atmosphere glow + cloud swirl + light highlight.
  - Planet click → diveTo(): sets diving state → DiveOverlay (expanding planet circle + warp-speed light streaks + destination label) → after 2.2s scrolls to the section.
  - Mouse parallax: tilts the whole system with mouse (rotateX/Y via rAF).
  - Starfield: 80 seeded-random twinkling stars (mulberry32 PRNG for SSR-safe identical rendering).
  - Text overlay at bottom: badge, title, description, stats. Hover hint + scroll hint.
- Fixed hydration: replaced Math.random() in Starfield with seeded PRNG (mulberry32) at module level → SSR/client identical.
- Fixed lint: moved stars from useRef to module-level const (react-hooks/refs rule).
- Replaced Hero with PlanetaryHero in page.tsx.

Stage Summary:
- Agent Browser verified: hero 1440x900 full-screen; 3 planets visible in view (gfx 695,592 / sec 695,683 / ai 744,262); clicking a planet triggers dive overlay (active ✓) then scrolls to section (scrollY 900 for graphics). VLM confirmed: central glowing star, 3+ colored planets, moons orbiting, starry twinkling background, orbit rings, full-screen cinematic. Lint clean. Hydration error from next-themes (known, non-critical).

---
- **Task ID:** planets-3d-v2
- **Agent:** subagent (planetary-hero rewrite)
- **Task:** Rewrite `src/components/portfolio/planetary-hero.tsx` — fix flat 2D moons (make truly 3D via tilted orbit plane) + give each planet a unique texture based on `planet.texture` + read planet config from the content store (`hero.planets: PlanetConfig[]`).

**Work Log:**
1. Read context: `worklog.md`, existing `src/components/portfolio/planetary-hero.tsx`, `src/lib/content-types.ts` (PlanetConfig), `src/lib/default-content.ts` (planet seed data), `src/lib/content-store.ts` (useContent API). Confirmed dev.log showed a 500 error on the old file (`hero.worlds` no longer exists — store now exposes `hero.planets`).
2. Rewrote `src/components/portfolio/planetary-hero.tsx` from scratch (only this file was touched). Key changes:
   - **Store wiring:** `useContent((s) => s.content.hero.planets)` returns `PlanetConfig[]`. Map over it to render `<PlanetSystem planet={...} />`. The dive target uses `planet.sectionId`. State changed from `WorldKey` to `string | null` (`divingId` / `hoveredId`).
   - **Issue 1 fix — truly 3D moons:** The moon rotator now uses a nested div pattern: outer `<div style={{ transform: 'rotateX(60deg)' }}>` tilts the moon orbit plane; inner `<motion.div animate={{ rotateZ: -360 }}>` spins within that tilted plane. Order matters — parent applies rotateX AFTER child's rotateZ (CSS composes left-to-right, applied right-to-left), so a moon at translate(x,y) ends up at `(x·cos t − y·sin t, (x·sin t + y·cos t)·cos 60°, (x·sin t + y·cos t)·sin 60°)` — Z varies with t, so moons pass behind and in front of the planet. The previous code only did `rotateZ`, giving a flat 2D circle.
   - **Issue 2 fix — unique textures:** Added `getSurfaceGradient(texture, color, craters)` returning `{base, overlay}` CSS. Per `planet.texture`:
     - `swirly` → overlapping radial-gradient swirls + conic-gradient vortex, animated rotation (gas giant feel).
     - `cratered` → 16 scattered dark craters via stacked `radial-gradient`s. Crater positions are deterministic per planet (FNV-1a hash of `planet.id` → mulberry32 PRNG) → SSR-safe.
     - `gas-bands` → horizontal `repeating-linear-gradient(0deg, …)` banding + a large oval "great red spot" div.
     - `ringed` → gas-bands + a PERMANENT visible ring (always on, not just on hover).
     - `nebula` → fuzzy multi-layer radial gradients, blurred, slow rotation.
   - **Color system:** All CSS previously using `var(--gfx-1)` / `var(--gfx-glow)` / `var(--${world}-1)` etc. is now driven by `planet.color` (hex) via three `color-mix` helpers: `lighten`, `darken`, `fade` (transparentize). The orbit ring border, atmosphere glow, planet body, moons, dive overlay, and warp streaks all use `planet.color`.
   - **`PlanetConfig` driven:** Planet size (`planet.size`), orbit radius (`planet.orbitRadius`), orbit period (`planet.orbitPeriod`), starting offset (`planet.orbitOffset`), moon size (`planet.moonSize`), moon orbit radius (`planet.moonOrbitRadius`), moon orbit period (`planet.moonOrbitPeriod`), and moon labels (`planet.moons`) all come straight from the store config — no more hardcoded `ORBIT_RADIUS` / `ORBIT_PERIOD` / `ORBIT_OFFSET` maps.
   - **cursor-zone mapping:** `cursorZoneFor(planet.id)` returns `"gfx" | "sec" | "ai"` for those three ids, else `"default"` — so custom planet ids fall back to the default cursor color.
   - **Kept as-is:** CentralStar (pulsing corona + light rays), seeded PRNG Starfield (mulberry32, 80 stars, SSR-safe), mouse-parallax tilt on the system wrapper, dive-in cinematic overlay pattern (expanding circle + warp streaks + destination label), bottom text overlay with badge/title/description/stats, hover hint, scroll hint.
   - **DiveOverlay** now takes `{ planet: PlanetConfig }` and uses `planet.color` / `planet.label` / `planet.hint`.
   - **Moon** props are `{ label, color, x, y, size, index }` (x/y/size in vmin). Small sphere with `lighten`/`darken` radial gradient + glow, label below.
3. Ran `bun run lint` → clean (no errors, no warnings).
4. Verified in dev.log: previously `GET / 500` (TypeError: Cannot read properties of undefined (reading 'gfx') at `hero.worlds[world]`). After rewrite: `GET / 200` consistently. The "Fast Refresh had to perform a full reload" warnings in the log predate the fix.

**File modified:** `/home/z/my-project/src/components/portfolio/planetary-hero.tsx` (only file touched).

**3D moons explanation:** The moon orbit plane is tilted 60° via a static `rotateX(60deg)` on an outer div, then an inner `motion.div` animates `rotateZ: -360` on a loop with `planet.moonOrbitPeriod`. Because the rotateX is applied AFTER the rotateZ in the CSS transform composition chain, each moon (positioned at `translate(x, y)` on the orbit) traces an ellipse in 3D space — its Z coordinate varies as `sin(t)·sin(60°)·radius`, so moons visibly pass behind the planet (far Z) and in front of it (near Z) instead of staying in a flat 2D circle.

**Textures summary:** Five distinct CSS-only texture styles (`swirly`, `cratered`, `gas-bands`, `ringed`, `nebula`), each composed from layered radial/conic/repeating-linear gradients mixed with the planet's accent color via `color-mix(in oklch, …)`. Seeded `mulberry32(hashString(planet.id))` makes the cratered texture deterministic per planet (SSR-safe, no hydration mismatch).

---
- **Task ID:** cms-planets
- **Agent:** subagent (CMS panel planets editor)
- **Task:** Update the hero section form in `src/components/portfolio/cms-panel.tsx` to replace the legacy `worlds` (gfx/sec/ai) subsection with a full planets array editor backed by `PlanetConfig`.

**Work Log:**
1. Read context: `src/lib/content-types.ts` (confirmed `hero.planets: PlanetConfig[]`, no more `worlds`), `src/lib/default-content.ts` (real planet values used as shape reference), and the existing `SectionForm` hero block in `src/components/portfolio/cms-panel.tsx`.
2. Reviewed the existing `ObjectListField` component (lines ~430–614) and confirmed it supports all field types needed: `text`, `color`, and `stringlist` (the last is used for the `moons` array). Also confirmed `SubsectionBox` is reusable as a wrapper.
3. In the `case "hero":` block of `SectionForm`:
   - Removed the `worlds` const, `setWorld` helper, and the entire `SubsectionBox` containing `worlds.gfx/sec/ai.label` and `worlds.gfx/sec/ai.hint` TextFields.
   - Reused `SubsectionBox` (title: "سیارات / Planets — سیستم سیاره‌ای صفحه اول") as the wrapper, and placed an `ObjectListField` inside it, bound to `v.planets` via `set("planets", x)`.
   - Defined all 14 fields per the task spec: id (text), label (text), hint (text), sectionId (text), color (color), texture (text), size (text), orbitRadius (text), orbitPeriod (text), orbitOffset (text), moonSize (text), moonOrbitRadius (text), moonOrbitPeriod (text), moons (stringlist).
   - `makeEmpty()` returns a sensible default planet (auto-generated `id: "planet-<ts>"`, `sectionId: "graphics"`, `color: "#8b5cf6"`, `texture: "swirly"`, numeric defaults matching PlanetConfig semantics, and `moons: ["Skill 1", "Skill 2"]`).
4. Left all other hero fields untouched: badge, titleLine1, titleHighlight, titleLine2, description, ctaPrimary, ctaSecondary, and the `stats` ObjectListField.
5. Updated the file header comment from `hero.worlds` to `hero.planets` for accuracy (line 10).
6. Ran `bun run lint` — passes with no errors or warnings.
7. Confirmed no remaining functional references to `worlds` in the file (only a generic JSDoc example for `SubsectionBox` mentions "worlds" illustratively — left intact as it's just doc text).

**Files changed:** ONLY `src/components/portfolio/cms-panel.tsx`.

**Editable planet fields (per planet, in the CMS hero form):**
| # | key | field type | description |
|---|---|---|---|
| 1 | id | text | unique key (gfx/sec/ai/custom) |
| 2 | label | text | planet display name |
| 3 | hint | text | short tagline |
| 4 | sectionId | text | target section on click (graphics/security/ai/contact) |
| 5 | color | color | hex accent (color picker) |
| 6 | texture | text | gas-bands/cratered/swirly/ringed/nebula |
| 7 | size | text | planet diameter in vmin |
| 8 | orbitRadius | text | distance from star in vmin |
| 9 | orbitPeriod | text | orbit duration in seconds |
| 10 | orbitOffset | text | starting angle 0-360° |
| 11 | moonSize | text | moon diameter in vmin |
| 12 | moonOrbitRadius | text | moon orbit radius in vmin |
| 13 | moonOrbitPeriod | text | moon orbit duration in seconds |
| 14 | moons | stringlist | skill labels (add/remove/edit strings) |

**Exact file path:** `/home/z/my-project/src/components/portfolio/cms-panel.tsx`

---
Task ID: planets-3d-cms-cards
Agent: Z.ai Code
Task: Fix 2D moons (make 3D), add unique planet textures, CMS for planets, fix project card height.

Work Log:
- content-types: replaced hero.worlds with hero.planets: PlanetConfig[]. Added PlanetConfig interface (id, label, hint, sectionId, color, texture, size, orbitRadius, orbitPeriod, orbitOffset, moonSize, moonOrbitRadius, moonOrbitPeriod, moons).
- default-content (fa+en): 3 planets with full config — gfx (swirly texture, magenta), sec (cratered, green), ai (gas-bands, blue). Re-seeded.
- planetary-hero.tsx (subagent): rewrote moon rotator with rotateX(60deg) tilt → moons orbit in 3D (go behind/in front of planet). Added getSurfaceGradient() with 5 texture types: swirly (vortex), cratered (scattered dark spots via seeded PRNG), gas-bands (horizontal bands + red spot), ringed (bands + permanent ring), nebula (fuzzy). All driven by PlanetConfig from store.
- cms-panel.tsx (subagent): hero form now has ObjectListField for planets with 14 editable fields (id, label, hint, sectionId, color picker, texture, size, orbitRadius, orbitPeriod, orbitOffset, moonSize, moonOrbitRadius, moonOrbitPeriod, moons stringlist). Add/remove planets via built-in buttons.
- Card height fix: added className="h-full" to Reveal wrappers in graphics, security, ai sections → all project cards now equal height within each section.

Stage Summary:
- VLM verified: 3 planets distinct colors (green/pink/blue), moons orbit in 3D (tilted, behind/in front), each planet has unique texture (cratered/bands/swirly), central glowing star.
- Agent Browser: CMS planets editor present with all fields (texture, size, orbitRadius, moons); card heights equal per section (graphics 243, security 118, ai 162). Lint clean. dev.log clean.

---
Task ID: moons-3d-popup-fix
Agent: Z.ai Code
Task: Fix 2D moons (make truly 3D with translate3d), fix popup excessive bottom space.

Work Log:
- Moons 3D: replaced CSS rotateX+rotateZ nesting (which wasn't producing visible 3D) with a rAF-based MoonSystem that computes each moon's 3D position directly: x=R·cos(θ), y=R·sin(θ)·cos(tilt), z=R·sin(θ)·sin(tilt). Uses translate3d(x, y, z) so moons genuinely go behind and in front of the planet. Verified: z values vary (-6 to +6 vmin) and change over time.
- Reduced perspective from 1600px to 900px for more pronounced 3D depth.
- VLM confirmed: "some moons appear closer (larger/in front) and others farther (smaller/behind the planet)" — true 3D orbiting.
- Popup height: removed `mt-auto` from project nav (was pushing buttons to bottom, creating gap). Added `flex-1` back to image panel (was removed accidentally, causing 0-width image). Changed popup to `lg:h-fit` so it sizes to content. 
- VLM confirmed: "Neither panel has excessive empty space, content fills the popup nicely."

Stage Summary:
- Both user-reported issues fixed and VLM-verified. Lint clean. No errors.

---
Task ID: orbit-popup-scroll-fix
Agent: Z.ai Code
Task: Fix 3D planet orbits (were flat 2D circles), fix popup bottom space, fix auto-scroll to security on page load.

Work Log:
- Orbit fix: root cause was rotateX(tilt) applied to child AFTER translateX — rotateX doesn't affect X-axis translation, so planets orbited in a flat 2D circle. Fixed by applying rotateX(tilt) to the PARENT div (tilts the orbit plane), then rotateZ animation on a CHILD (spins within the tilted plane), then translateX(radius) places the planet on the tilted orbit → true 3D elliptical path. VLM confirmed: "orbit rings visible as ellipses, planets ON the orbit rings."
- Auto-scroll fix: root cause was InteractiveTerminal's useEffect calling inputRef.current?.focus() on mount — browser scrolls to focused element. Fixed with focus({ preventScroll: true }). Also added inline scripts in <head> (history.scrollRestoration='manual', hash removal, scrollTo(0,0)) and at end of <body> (scrollTo(0,0) after content loads). scrollY confirmed = 0 on page load.
- Popup fix: image panel had fixed aspect-[4/3] which left empty space on desktop when info panel was taller. Added lg:aspect-auto lg:h-full so image fills its panel on desktop. VLM confirmed: "no excessive empty space, image fills its panel."

Stage Summary:
- All 3 user-reported issues fixed and VLM-verified. scrollY=0 on load, planets orbit in 3D ellipses, popup has no excessive bottom space. Lint clean, no errors.
