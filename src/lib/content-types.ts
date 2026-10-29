// Shared content schema — the single source of truth for all editable site content.
// Each section is stored per-language: { fa: <section>, en: <section> }.

export type SectionKey =
  | "site"
  | "hero"
  | "graphics"
  | "security"
  | "ai"
  | "synthesis"
  | "timeline"
  | "profile"
  | "music"
  | "footer"
  | "explorer"
  | "museum"
  | "design"
  | "meteors"
  | "forms"
  | "builder"
  | "error404"
  | "developer"
  | "pwa"
  | "seo"
  | "assistant";

export type Lang = "fa" | "en";

// A gallery project — used by the graphics gallery (and reusable elsewhere).
export interface ProjectArtwork {
  title: string;
  meta: string;
  category: string;
  color: string;
  year: string;
  client: string;
  role: string;
  description: string;
  specs: { key: string; value: string }[];
  images: string[];
  link: string;
  links?: { label: string; url: string; kind: "live" | "source" | "github" | "docs" | "other" }[];
  /** where the project happened / was delivered (city, country or "Remote") */
  location?: string;
  /** human period, e.g. "2024 Q2 — 2024 Q4" */
  dates?: string;
  /** lifecycle badge: completed / in-progress / archived … */
  status?: string;
  /** free-form tags shown as chips */
  tags?: string[];
  /** project process milestones (روند پروژه) */
  process?: { title: string; date: string; description: string }[];
  /** video media: direct mp4/webm URLs (poster optional). First video is
   *  used as the card preview when present. */
  videos?: { url: string; poster: string; label: string }[];
  /** FEATURED/cover image — picked from the project's images or uploaded
   *  separately. Highest preview priority everywhere (cards, slides, the
   *  3D museum wall, catalogue cover). When empty the museum renders a
   *  typographic plate (project title + category) instead. */
  featured?: string;
  /** Set by the SERVER while this project is password-locked (Access Guard
   *  target proj:<section>:<slug>): all payload fields arrive emptied and
   *  the gallery renders a lock card until the visitor unlocks. */
  locked?: boolean;
}

export type GalleryLayout = "cinematic" | "grid" | "masonry" | "spotlight" | "hall";

export interface PortfolioGalleryConfig {
  title: string;
  subtitle: string;
  enterLabel: string;
  /** Display style of the fullscreen gallery popup. Defaults to "cinematic". */
  layout?: GalleryLayout;
  projects: ProjectArtwork[];
}

export interface ExplorerChapterConfig {
  id: string;
  title: string;
  clue: string;
  color: string;
  icon: string;
  enabled: boolean;
}

export interface ExplorerConfig {
  enabled: boolean;
  autoSync: boolean;
  headerLabel: string;
  kicker: string;
  title: string;
  subtitle: string;
  progressLabel: string;
  timeLabel: string;
  rankLabel: string;
  nextLabel: string;
  surpriseLabel: string;
  tourAgainLabel: string;
  passportTitle: string;
  passportHeading: string;
  passportDescription: string;
  completeDescription: string;
  lockedDescription: string;
  downloadLabel: string;
  shareLabel: string;
  rankMaster: string;
  rankWalker: string;
  rankSeeker: string;
  rankNew: string;
  showTimer: boolean;
  showRank: boolean;
  showSurprise: boolean;
  showPassport: boolean;
  chapters: ExplorerChapterConfig[];
}

export interface MuseumDeckOverride {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

export interface MuseumDeckConfig extends MuseumDeckOverride {
  projects: ProjectArtwork[];
}

export interface MuseumConfig {
  introKicker: string;
  introTitle: string;
  introDescription: string;
  boardLabel: string;
  deviceHint: string;
  showDeviceHint: boolean;
  showMinimap: boolean;
  showDeckGuide: boolean;
  autoSync: boolean;
  quality: "auto" | "high" | "low";
  starCount: number;
  galaxyCount: number;
  asteroidCount: number;
  meteorCount: number;
  creatureCount: number;
  nebulaIntensity: number;
  trafficEnabled: boolean;
  creaturesEnabled: boolean;
  bookBreakpoint: number;
  decks: MuseumDeckOverride[];
  extraDecks: MuseumDeckConfig[];
}

export interface DeveloperConfig {
  name: string;
  role: string;
  description: string;
  email: string;
  github: string;
  license: string;
  licenseUrl: string;
  wallet: string;
  donationTitle: string;
  donationDescription: string;
}

// A planet in the hero solar system. Fully CMS-customizable.
export interface PlanetConfig {
  id: string;            // unique key: "gfx" | "sec" | "ai" | custom
  label: string;         // planet name (e.g. "گرافیک")
  hint: string;          // short tagline
  sectionId: string;     // which section to scroll to on click
  color: string;         // hex accent color
  texture: string;       // texture style: "gas-bands" | "cratered" | "swirly" | "ringed" | "nebula"
  size: number;          // planet diameter in vmin (e.g. 8)
  orbitRadius: number;   // distance from star in vmin (e.g. 20)
  orbitPeriod: number;   // orbit duration in seconds (e.g. 40)
  orbitOffset: number;   // starting angle in degrees (0-360)
  moonSize: number;      // moon diameter in vmin (e.g. 2)
  moonOrbitRadius: number; // moon orbit radius in vmin (e.g. 7)
  moonOrbitPeriod: number; // moon orbit duration in seconds (e.g. 10)
  moonOrbitOffset: number; // starting angle for moon system in degrees
  moonOrbitTiltX: number;  // moon orbit plane tilt around X in degrees
  moonOrbitTiltY: number;  // moon orbit plane tilt around Y in degrees
  moonOrbitTiltZ: number;  // moon orbit plane tilt around Z in degrees
  moons: string[];       // moon labels (skills)
}

export interface PlanetViewConfig {
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  targetY: number;
  systemTiltX: number;
  systemTiltZ: number;
  orbitScale: number;
  planetScale: number;
  moonScale: number;
  labelScale: number;
}

// The central star (sun) of the hero solar system — "me".
// Clicking it opens the profile modal (bio, skills, resume download).
export interface StarConfig {
  enabled: boolean;      // when false the star is not clickable
  label: string;         // e.g. "این منم / This is me"
  hint: string;          // short tagline under the label
  color: string;         // hex accent for glow / flare effects
}

export interface HeroWorldConfig {
  label: string;
  hint: string;
}

export interface BackgroundBlobConfig {
  color: string;
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
}

export interface BackgroundDesignConfig {
  baseColor: string;
  opacity: number;
  blur: number;
  speed: number;
  blendMode: string;
  grainOpacity: number;
  vignetteStrength: number;
  blobs: BackgroundBlobConfig[];
  comets: CometConfig;
}

/** Occasional shooting-star streaks crossing the background. */
export interface CometConfig {
  enabled: boolean;
  minIntervalSec: number; // 3-120 — pause between passes
  maxIntervalSec: number;
  streaksPerPass: number; // 1-12 comets per pass
  color: string;          // hex; "auto" = white-star
  durationMs: number;     // 800-8000 flight time
  direction: "random" | "left-to-right" | "right-to-left" | "alternating";
  style: "realistic" | "aurora" | "minimal";
  angleMin: number;
  angleMax: number;
  lengthMin: number;
  lengthMax: number;
  thickness: number;
  glow: number;
  headSize: number;
  spawnTop: number;
  spawnBottom: number;
}

export interface CursorDesignConfig {
  enabled: boolean;
  hoverScale: number;
  ringSize: number;
  ringHoverSize: number;
  ringOpacity: number;
  ringBorderWidth: number;
  dotSize: number;
  dotOpacity: number;
  smoothing: number;
  labelOffsetX: number;
  labelOffsetY: number;
  labelOpacity: number;
  trailEnabled: boolean;
  trailLength: number;
  trailSize: number;
  trailOpacity: number;
  trailColor: string;
  blendMode: string;
  labels: {
    default: string;
    gfx: string;
    sec: string;
    ai: string;
  };
  colors: {
    default: string;
    gfx: string;
    sec: string;
    ai: string;
  };
}

export interface SceneObject3DConfig {
  id: string;
  label: string;
  enabled: boolean;
  slot: "hero-primary" | "planetary-center" | "graphics-main" | "graphics-ambient" | "security-ambient" | "ai-ambient" | "section" | "custom";
  /** Target section when slot=section. Built-ins and custom-* ids are valid. */
  sectionId?: string;
  kind: "glass-blob" | "crystal" | "orbit" | "neural" | "ribbon" | "prism" | "pen-nib" | "palette" | "lattice" | "capsule" | "atom" | "dna" | "mobius" | "gear" | "satellite" | "rocket" | "robot" | "gamepad" | "globe" | "cube" | "cluster" | "chain" | "flower" | "wave-sphere" | "cyber-eye" | "model";
  modelUrl: string;
  link: string;
  colorA: string;
  colorB: string;
  colorC: string;
  opacity: number;
  scale: number;
  x: number;
  y: number;
  z: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  speed: number;
  morphIntensity: number;
  magmaIntensity: number;
  hoverEffect: "none" | "scale" | "glow" | "tilt" | "morph";
  animation: "idle" | "spin" | "float" | "pulse" | "magma";
  /* DOM placement (CMS-controlled, logical/direction-aware):
     - domSide: which inline side of the section the object hugs.
       "end" sits opposite the reading start (flips automatically in RTL).
     - domTop: distance from the section top, in percent.
     - domOffset: distance from the chosen side, in rem (negative = bleed outward).
     - domSize: container size in px. */
  domSide: "start" | "end" | "center";
  /** Exact horizontal position inside a section (0-100%). Overrides domSide. */
  domX?: number;
  domTop: number;
  domOffset: number;
  domSize: number;
}

export type AnimationPresetConfig = {
  id: string;
  label: string;
  enabled: boolean;
  target: string;
  trigger: "load" | "hover" | "scroll" | "always";
  type:
    | "fade" | "slide" | "float" | "pulse" | "spin" | "tilt" | "glow" | "custom"
    | "zoom" | "blur-in" | "flip-3d" | "glide-3d" | "bob";
  duration: number;
  delay: number;
  easing: string;
  intensity: number;
  customCss: string;
};

/** Global performance / motion preferences, CMS-controlled. */
export interface PerformanceConfig {
  /** Render-loop frame cap in FPS: 30–640. 0 = unlimited (display rate).
   *  Values above the display refresh simply have no throttling effect. */
  frameRate: number;
  /** Idle time before the hyperspace screensaver, in seconds. 0 = off. */
  screensaverSeconds: number;
  /** Site-wide animation mode — see globals.css [data-anim-mode] rules. */
  animationMode: "off" | "reduced" | "normal" | "cinematic";
}

export interface CacheConfig {
  enabled: boolean;
  contentTtlSeconds: number;
  staticMaxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  maxCanvasDpr: number;
  lazy3D: boolean;
  pauseOffscreen3D: boolean;
  /** Warm lazy images + heavy chunks in the background after load
   *  (only when the visitor's connection is fast). Default: true. */
  preloadAssets?: boolean;
}

export interface EmailDeliveryConfig {
  enabled: boolean;
  /** "none" stores nothing;
   *  smtp/gmail/microsoft/custom send email server-side;
   *  mailto / whatsapp-link / telegram-link need NO server at all — the
   *  visitor's own apps deliver the composed message straight to you
   *  (free, works on the cheapest hosting, zero maintenance). */
  provider: "none" | "smtp" | "gmail" | "microsoft" | "custom" | "mailto" | "whatsapp-link" | "telegram-link" | "telegram-bot" | "whatsapp-cloud";
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  to: string;
  subjectPrefix: string;
  replyToField: string;
  passwordEnv: string;
  /* mailto provider → recipient address (uses the existing `to` field) */
  /* whatsapp-link provider → your number in international digits (98912…) */
  whatsappPhone: string;
  /* telegram-link provider → your @username (t.me/username) */
  telegramUsername: string;
  /** Bot/API secrets are never stored in CMS; these are environment-variable names. */
  telegramBotTokenEnv?: string;
  telegramChatId?: string;
  whatsappTokenEnv?: string;
  whatsappPhoneNumberId?: string;
  whatsappRecipient?: string;
  whatsappApiVersion?: string;
}

/** Meteor-shower easter egg (triggered by shaking the mouse). */
export interface ExternalAnalyticsConfig {
  /** GA4 measurement id, e.g. G-XXXXXXX */
  ga4Id?: string;
  /** Google Tag Manager container id, e.g. GTM-XXXXXX */
  gtmId?: string;
  /** Hotjar site id */
  hotjarId?: string;
  /** Plausible domain, e.g. example.com */
  plausibleDomain?: string;
  /** Matomo URL, e.g. https://matomo.example.com/ */
  matomoUrl?: string;
  matomoSiteId?: string;
  /** Cloudflare Web Analytics token */
  cloudflareToken?: string;
  /** HubSpot portal id for the tracking script */
  hubspotId?: string;
  /** Google Search Console verification token (rendered SSR as
   *  <meta name="google-site-verification">). */
  gscVerification?: string;
}

export interface MeteorShowerConfig {
  enabled: boolean;
  /** emoji/object that rains down — any emoji or short text */
  emoji: string;
  /** how many objects per shower */
  density: number;        // 4–40
  /** shower lifetime in ms */
  durationMs: number;     // 600–8000
  /** minimum pause between two showers in ms */
  cooldownMs: number;     // 1000–60000
  /** average mouse speed (px/ms) needed to trigger — lower = easier */
  triggerSpeed: number;   // 0.3–8
  /** travel direction */
  direction: "down" | "start" | "end" | "random";
  style: "realistic" | "aurora" | "minimal";
  headStyle: "comet" | "star" | "diamond" | "none" | "emoji";
  color: string;
  angleMin: number;
  angleMax: number;
  lengthMin: number;
  lengthMax: number;
  thickness: number;
  glow: number;
  headSize: number;
  spread: number;
}

/** Single CMS source for every ambient and pointer-triggered meteor effect. */
export interface MeteorControlsConfig {
  ambient: CometConfig;
  shower: MeteorShowerConfig;
}

export interface FormFieldConfig {
  id: string;
  label: string;
  type: "text" | "email" | "textarea" | "select" | "checkbox" | "radio" | "number" | "tel" | "url";
  placeholder: string;
  required: boolean;
  options: string[];
  width: "full" | "half";
  stepId: string;
  showWhenField: string;
  showWhenOperator: "equals" | "notEquals" | "contains" | "filled" | "empty";
  showWhenValue: string;
}

export interface FormStepConfig {
  id: string;
  title: string;
  description: string;
  nextLabel: string;
  backLabel: string;
  submitLabel: string;
}

export interface FormGraphEdgeConfig {
  id: string;
  fromStepId: string;
  toStepId: string;
  fieldId: string;
  operator: "always" | "equals" | "notEquals" | "contains" | "filled" | "empty";
  value: string;
}

export interface FormBuilderConfig {
  enabled: boolean;
  activeFormId: string;
  antiSpam: {
    honeypotField: string;
    minimumSubmitMs: number;
    maxPerHour: number;
    blockedMessage: string;
  };
  email: EmailDeliveryConfig;
  forms: {
    id: string;
    name: string;
    title: string;
    description: string;
    successMessage: string;
    errorMessage: string;
    layout: "single" | "multi";
    /** Render this reusable form in one or more page sections. */
    sectionIds?: string[];
    steps: FormStepConfig[];
    fields: FormFieldConfig[];
    edges: FormGraphEdgeConfig[];
  }[];
}

export interface BuilderNavItemConfig {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  external: boolean;
  order: number;
  color: string;
  hoverLabel: string;
}

export interface BuilderSectionConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  anchor: string;
  layout: "default" | "compact" | "wide" | "split" | "canvas";
  paddingTop: number;
  paddingBottom: number;
  /** External distance from the previous section. */
  gapBefore?: number;
  /** Space after this section when global spacingMode is manual. */
  gapAfter?: number;
  maxWidth: number;
  /** Automatic/base scale inherited by every viewport until overridden. */
  fontScale?: number;
  /** Automatic/base object scale inherited by every viewport until overridden. */
  objectScale?: number;
  background: string;
  accent: string;
  textColor: string;
  radius: number;
  blur: number;
  opacity: number;
  link: string;
  hoverEffect: "none" | "lift" | "glow" | "tilt" | "magnetic" | "invert";
  customClass: string;
}

export interface BuilderComponentConfig {
  id: string;
  label: string;
  type: "header" | "menu" | "button" | "card" | "section" | "badge" | "modal" | "custom";
  enabled: boolean;
  target: string;
  order: number;
  text: string;
  href: string;
  icon: string;
  color: string;
  background: string;
  borderColor: string;
  radius: number;
  paddingX: number;
  paddingY: number;
  fontSize: number;
  opacity: number;
  hoverEffect: "none" | "lift" | "glow" | "scale" | "underline" | "blur" | "tilt";
  animation: "none" | "fade" | "slide" | "float" | "pulse" | "spin";
  customCss: string;
}

export type BuilderDevice = "desktop" | "tablet" | "mobile";

export interface BuilderDeviceSectionConfig {
  id: string;
  enabled: boolean;
  order: number;
  paddingTop: number;
  paddingBottom: number;
  gapBefore: number;
  gapAfter: number;
  maxWidth: number;
  fontScale: number;
  objectScale: number;
}

export interface BuilderDeviceConfig {
  canvasWidth: number;
  /** False means this viewport inherits the automatic/base layout. */
  overrideEnabled?: boolean;
  sections: BuilderDeviceSectionConfig[];
}

export interface BuilderResponsiveConfig {
  enabled: boolean;
  tabletBreakpoint: number;
  mobileBreakpoint: number;
  devices: Record<BuilderDevice, BuilderDeviceConfig>;
}

export interface SharedResumeConfig {
  id: string;
  name: string;
  enabled: boolean;
  sectionIds: string[];
  title: string;
  summary: string;
  media: string[];
  links: { label: string; url: string; kind: string }[];
}

export type VisualElementKind = "text" | "button" | "image" | "video" | "audio" | "lottie" | "form" | "icon" | "model3d" | "native";

export interface VisualElementPlacement {
  /** Percentages relative to the section canvas. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
}

export interface VisualElementConfig {
  id: string;
  name: string;
  sectionId: string;
  kind: VisualElementKind;
  text: string;
  mediaUrl: string;
  href: string;
  formId: string;
  icon: string;
  color: string;
  background: string;
  borderColor: string;
  borderRadius: number;
  fontSize: number;
  className: string;
  /** CSS selector for a real DOM node in a built-in section. */
  selector?: string;
  placements: Record<BuilderDevice, VisualElementPlacement>;
}

export interface BuilderVersionConfig {
  id: string;
  name: string;
  createdAt: string;
  /** JSON snapshot of the complete visual/responsive layout; legacy element-only arrays remain supported. */
  snapshot: string;
}

export interface BuilderConfig {
  enabled: boolean;
  /** Explicit empty-page state created by Factory Reset. */
  blankCanvas: boolean;
  editModeHint: string;
  helpGuide: string;
  performance: PerformanceConfig;
  /** Meteor-shower easter egg settings (Builder ← ⚡/☄️ section). */
  meteor: MeteorShowerConfig;
  cache: CacheConfig;
  /** External traffic-monitoring integrations (consent-gated). */
  analytics?: ExternalAnalyticsConfig;
  global: {
    maxWidth: number;
    sectionGap: number;
    spacingMode: "auto" | "manual";
    cardRadius: number;
    buttonRadius: number;
    glassOpacity: number;
    borderOpacity: number;
    shadowStrength: number;
    animationSpeed: number;
    hoverScale: number;
    focusRingColor: string;
    selectionColor: string;
    /** Font applied to the currently edited language interface. */
    fontFamily: string;
    /** Optional uploaded font URL from the universal media library. */
    fontUrl: string;
    customCss: string;
  };
  header: {
    enabled: boolean;
    sticky: boolean;
    height: number;
    blur: number;
    opacity: number;
    background: string;
    borderColor: string;
    logoText: string;
    logoImage: string;
    logoAlt: string;
    logoShape: "rounded" | "circle" | "square" | "diamond" | "none";
    logoGradient: string;
    contentGap: number;
    showThemeToggle: boolean;
    showLanguageToggle: boolean;
    showCmsButton: boolean;
    hoverEffect: "none" | "pill" | "underline" | "glow" | "magnetic";
    mobileMenuStyle: "sheet" | "dropdown" | "full";
  };
  navigation: BuilderNavItemConfig[];
  sections: BuilderSectionConfig[];
  components: BuilderComponentConfig[];
  animations: AnimationPresetConfig[];
  /** Elementor-like layout overrides, independently deployable per viewport. */
  responsive?: BuilderResponsiveConfig;
  /**
   * Complete per-section content snapshots for each viewport. Missing entries
   * inherit the Automatic/base CMS content. This intentionally lives outside
   * `responsive` because builder rows are localized while layout is shared.
   */
  deviceContentOverrides?: Partial<Record<BuilderDevice, Record<string, unknown>>>;
  /** Reusable résumé blocks can be assigned to any number of sections. */
  sharedResumes?: SharedResumeConfig[];
  /** Free-positioned, per-device elements rendered inside any section. */
  visualElements?: VisualElementConfig[];
  /** Named visual-layout checkpoints. */
  versions?: BuilderVersionConfig[];
}

export interface Error404Config {
  badge: string;
  title: string;
  highlight: string;
  description: string;
  astronautLabel: string;
  revealLabel: string;
  startLabel: string;
  backLabel: string;
  restartLabel: string;
  leaderboardLabel: string;
  scoreLabel: string;
  livesLabel: string;
  gameOverTitle: string;
  gameOverDescription: string;
  playerNamePlaceholder: string;
  submitScoreLabel: string;
  difficultyLabel: string;
  coinsLabel: string;
  shopLabel: string;
  shieldLabel: string;
  magnetLabel: string;
  buyLabel: string;
  equippedLabel: string;
  finalScoreLabel: string;
  assets: {
    lostAstronaut: string;
    playerAstronaut: string;
    comet: string;
  };
  colors: {
    suit: string;
    visor: string;
    tether: string;
    asteroid: string;
    star: string;
    accent: string;
    danger: string;
  };
  game: {
    enabled: boolean;
    canvasHeight: number;
    playerSize: number;
    asteroidCount: number;
    asteroidMinSize: number;
    asteroidMaxSize: number;
    speed: number;
    acceleration: number;
    starCount: number;
    lives: number;
    leaderboardLimit: number;
    coinCount: number;
    coinValue: number;
    shieldCost: number;
    magnetCost: number;
  };
}

/* ============================================================
   TIMELINE — career / life journey section
   12 space-themed layout styles (2D + 3D), all CMS-switchable.
   ============================================================ */
export type TimelineStyle =
  | "orbit-path"       // vertical glowing orbit line + planet nodes
  | "alternating"      // zig-zag cards left/right of a comet trail
  | "horizontal-rail"  // horizontal mission-control rail (scroll-snap)
  | "constellation"    // SVG constellation — stars + connecting lines
  | "comet"            // scroll-driven comet with lit tail
  | "mission-log"      // monospace mission-control log
  | "planet-hop"       // 3D CSS planet spheres + trajectory arcs
  | "spiral"           // perspective galaxy spiral (3D)
  | "radar-ring"       // circular HUD ring with orbiting entries
  | "warp-lane"        // 3D perspective converging warp lanes
  | "signal"           // deep-space signal pulse with blips
  | "parallax-field";  // parallax star-depth floating cards

export interface TimelineEntry {
  id: string;
  date: string;        // e.g. "۲۰۲۳" or "2023 — 2025"
  title: string;       // role / achievement
  org: string;         // company / place
  description: string;
  tags: string[];      // skill chips
  icon: string;        // emoji or short glyph shown in the node
  color: string;       // node accent color (hex)
  kind: "job" | "edu" | "project" | "award" | "milestone";
}

export interface TimelineConfig {
  index: string;
  kicker: string;
  title: string;
  highlight: string;
  subtitle: string;
  style: TimelineStyle;
  showIcons: boolean;
  showFilter: boolean;
  entries: TimelineEntry[];
}

/* ============================================================
   PROFILE — "about me" + resume. Surfaced by clicking the sun.
   ============================================================ */
export interface ProfileSocial {
  id: string;
  platform: string;   // GitHub / LinkedIn / …
  label: string;
  url: string;
  icon: string;       // "github" | "linkedin" | "mail" | "globe" | "file"
}

export interface ProfileSkill {
  id: string;
  label: string;
  level: number;      // 0-100
  color: string;      // hex
}

export interface ProfileFact {
  id: string;
  key: string;
  value: string;
}

export interface ProfileStat {
  id: string;
  value: string;
  label: string;
}

export interface ProfileConfig {
  enabled: boolean;
  name: string;
  role: string;
  tagline: string;
  bio: string;              // multi-paragraph (\n separated)
  projectTitle: string;
  projectDescription: string;
  projectFeatures: string[];
  avatar: string;           // image URL (optional)
  location: string;
  email: string;
  phone: string;
  availability: string;     // e.g. "آماده همکاری"
  resumeUrl: string;        // /api/uploads/<id> or external URL
  resumeLabel: string;      // download button label
  resumeHint: string;       // small hint under the button
  socials: ProfileSocial[];
  skills: ProfileSkill[];
  facts: ProfileFact[];
  stats: ProfileStat[];
  languages: { id: string; name: string; level: string }[];
}

/** Shape of a user-created custom section (stored under `custom-*` keys). */
export interface CustomSectionData {
  title: string;
  subtitle: string;
  body: string;
  items: { key: string; value: string }[];
  ctaLabel: string;
  ctaUrl: string;
  badge: string;
  /** Optional fullscreen project gallery — same config the graphics/
   *  security/ai galleries use. Password-lockable per section via the
   *  Access Guard target `gallery:custom-*`. */
  gallery?: PortfolioGalleryConfig | null;
}

/* ============================================================
   MUSIC PLAYER — floating player + Spotify embed + 10-band EQ
   + audio-reactive planets (they dance to the rhythm).
   ============================================================ */
export interface TrackConfig {
  id: string;
  title: string;
  artist: string;
  uploadUrl: string; // /api/uploads/<id>
}

export interface PlayerConfig {
  enabled: boolean;
  /** bottom corner of the screen (logical: start/end flips in RTL) */
  position: "start" | "end";
  defaultVolume: number; // 0-100
  tracks: TrackConfig[];
  /** full Spotify playlist URL or URI (plays via the official embed) */
  spotifyPlaylistUrl: string;
  /** free direct-stream radio stations (play fully, no account needed) */
  radio: {
    enabled: boolean;
    stations: RadioStationConfig[];
  };
  visualizer: {
    enabled: boolean;
    style: "bars" | "orbit" | "wave";
    /** planets & 3D objects dance to the music rhythm */
    reactive3d: boolean;
    sensitivity: number; // 0.2-3
    /** how far planets physically travel while dancing (0-3) */
    danceAmplitude: number;
  };
  equalizer: {
    enabled: boolean;
    preset: "flat" | "bass" | "vocal" | "space" | "custom";
    /** 10 band gains in dB (-12..12): 60Hz…16kHz */
    bands: number[];
  };
}

export interface RadioStationConfig {
  id: string;
  name: string;
  url: string; // direct stream URL (e.g. SomaFM space stations)
}

export interface SiteContent {
  site: {
    brand: string;
    brandYear: string;
    /** Browser tab title; updated live when the active CMS language changes. */
    browserTitle: string;
    /** Browser tab icon. Accepts an uploaded image/SVG or an absolute URL. */
    favicon: string;
    navGraphics: string;
    navSecurity: string;
    navAI: string;
    navContact: string;
    statusBadge: string;
  };
  hero: {
    badge: string;
    titleLine1: string;
    titleHighlight: string;
    titleLine2: string;
    description: string;
    ctaPrimary: string;
    ctaSecondary: string;
    stats: { value: string; label: string }[];
    worlds: {
      gfx: HeroWorldConfig;
      sec: HeroWorldConfig;
      ai: HeroWorldConfig;
    };
    // Planetary hero — array of fully-customizable planets
    planets: PlanetConfig[];
    planetView: PlanetViewConfig;
    // The central star — click to open the profile (bio + resume)
    star: StarConfig;
  };
  graphics: {
    index: string;
    kicker: string;
    title: string;
    highlight: string;
    subtitle: string;
    projects: {
      title: string;
      cat: string;
      desc: string;
      tag: string;
    }[];
    tools: string[];
    cta: { label: string };
    // Project gallery — each project has images, specs, description
    gallery: PortfolioGalleryConfig;
  };
  security: {
    index: string;
    kicker: string;
    title: string;
    highlight: string;
    subtitle: string;
    projects: {
      title: string;
      cat: string;
      desc: string;
      metric: string;
      metricLabel: string;
    }[];
    skills: { label: string }[];
    certs: string[];
    cta: { label: string };
    game: { title: string; subtitle: string };
    gallery: PortfolioGalleryConfig;
  };
  ai: {
    index: string;
    kicker: string;
    title: string;
    highlight: string;
    subtitle: string;
    projects: {
      title: string;
      cat: string;
      desc: string;
      tags: string[];
    }[];
    stack: string[];
    cta: { label: string };
    game: { title: string; subtitle: string };
    gallery: PortfolioGalleryConfig;
    visual: {
      enabled: boolean;
      label: string;
      model: string;
      nodes: number;
      speed: number;
      scale: number;
      x: number;
      y: number;
    };
  };
  synthesis: {
    title: string;
    highlight1: string;
    highlight2: string;
    highlight3: string;
    titleLine2: string;
    subtitle: string;
    cta: string;
  };
  timeline: TimelineConfig;
  profile: ProfileConfig;
  music: PlayerConfig;
  footer: {
    badge: string;
    title: string;
    highlight: string;
    description: string;
    location: string;
    email: string;
    github: string;
    linkedin: string;
    twitter: string;
    copyright: string;
    version: string;
    builtWith: string;
  };
  developer: DeveloperConfig;
  explorer: ExplorerConfig;
  museum: MuseumConfig;
  design: {
    background: BackgroundDesignConfig;
    cursor: CursorDesignConfig;
    objects: SceneObject3DConfig[];
    animations?: AnimationPresetConfig[];
  };
  meteors: MeteorControlsConfig;
  forms: FormBuilderConfig;
  builder: BuilderConfig;
  error404: Error404Config;
  /** PWA install experience — feeds app/manifest.ts. Global settings. */
  pwa: PwaConfig;
  /** Native SEO management — feeds layout metadata, robots & JSON-LD. Global. */
  seo: SeoConfig;
  /** Pixel-buddy AI chat widget (connects to any provider from the CMS). Global. */
  assistant: AssistantConfig;
}

export interface SeoConfig {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogImage: string;
  robots: string;
  canonicalHost: string;
  authorName: string;
  twitterCard: "summary" | "summary_large_image";
  jsonldPerson: boolean;
  noindexDev: boolean;
}

export type AssistantProvider =
  | "pollinations" | "openai" | "zai" | "qwen" | "groq" | "anthropic" | "google" | "custom";

export interface AssistantConfig {
  enabled: boolean;
  provider: AssistantProvider;
  baseUrl: string;
  model: string;
  /** Env var NAME holding the API key (key itself never enters the DB). */
  apiKeyEnv: string;
  persona: string;
  greeting: string;
  position: "start" | "end" | "custom";
  /** Custom position when position="custom" (0-100 viewport percentages). */
  customX: number;
  customY: number;
  accent: string;
  /** Pet look — blob | cat | ghost | invader | slime | robot | star. */
  character: string;
  /** Owner's second brain — a markdown memo the AI always reads FIRST
   *  (upload/download/edit from the CMS Pixel Buddy section). */
  memory: string;
  /** Let VISITORS pick the pet's look themselves (stored per-browser). */
  visitorChoice: boolean;
  /** Fallback chain: comma-separated provider IDs in priority order.
   *  e.g. "google,groq,pollinations" — auto-fails-over on quota/timeout. */
  fallbackChain: string;
}

export interface PwaConfig {
  /** Full app name shown under the installed icon and in install prompts. */
  name: string;
  /** Short name for home-screen icons (max ~12 chars recommended). */
  shortName: string;
  description: string;
  /** BCP-47 language tag for the manifest (e.g. "en", "fa"). */
  lang: string;
  dir: "ltr" | "rtl";
  /** Where the installed app opens. */
  startUrl: string;
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  orientation: "any" | "portrait" | "landscape";
  /** Browser UI / OS titlebar color (hex). */
  themeColor: string;
  /** Splash screen background (hex). */
  backgroundColor: string;
  /** Any-size vector icon (SVG). Falls back to /logo.svg. */
  iconSvg: string;
  /** PNG icons for Android/Chrome install prompts (upload via Media Library). */
  icon192: string;
  icon512: string;
  /** Optional maskable variant (safe-area-padded) for Android adaptive icons. */
  iconMaskable512: string;
  /** iOS home-screen icon (~180×180 PNG). */
  appleTouchIcon: string;
  /** Comma-separated Web Store categories (e.g. "productivity, business"). */
  categories: string;
}

export const SECTION_KEYS: SectionKey[] = [
  "site",
  "hero",
  "graphics",
  "security",
  "ai",
  "synthesis",
  "timeline",
  "profile",
  "music",
  "footer",
  "explorer",
  "museum",
  "design",
  "meteors",
  "forms",
  "builder",
  "error404",
  "developer",
  "pwa",
  "seo",
  "assistant",
];

// Bilingual container stored in DB.
export type BilingualSection = { fa: unknown; en: unknown };
export type BilingualContent = Record<SectionKey, BilingualSection>;
