/* ==================================================================
 * Icon library — curated Font Awesome (solid) set + the original lucide
 * picks, powering the CMS custom-section icon picker.
 *
 * FA keys are stored as "fa-<name>" and rendered with
 * <i className="fa-solid fa-<name>" /> (CSS ships with
 * @fortawesome/fontawesome-free, imported once in the CMS panel).
 * Anything else falls back to lucide by key.
 * ================================================================== */

export interface LibraryIcon {
  key: string;      // "fa-rocket" | "star" | …
  label: string;    // searchable label (English)
  fa?: string;      // fa class name when it's a Font Awesome icon
  group: string;
}

/** Original lucide picks (kept first for backwards compatibility). */
export const LUCIDE_ICONS: LibraryIcon[] = [
  { key: "file", label: "File", group: "Lucide" },
  { key: "star", label: "Star", group: "Lucide" },
  { key: "tag", label: "Tag", group: "Lucide" },
  { key: "box", label: "Box", group: "Lucide" },
  { key: "heart", label: "Heart", group: "Lucide" },
  { key: "settings", label: "Settings", group: "Lucide" },
];

/** Curated Font Awesome 7 solid set (~120 icons, grouped + searchable). */
export const FA_ICONS: LibraryIcon[] = [
  // space & science
  { key: "fa-rocket", fa: "fa-rocket", label: "Rocket", group: "Space" },
  { key: "fa-satellite", fa: "fa-satellite", label: "Satellite", group: "Space" },
  { key: "fa-user-astronaut", fa: "fa-user-astronaut", label: "Astronaut", group: "Space" },
  { key: "fa-moon", fa: "fa-moon", label: "Moon", group: "Space" },
  { key: "fa-sun", fa: "fa-sun", label: "Sun", group: "Space" },
  { key: "fa-star", fa: "fa-star", label: "Star", group: "Space" },
  { key: "fa-meteor", fa: "fa-meteor", label: "Meteor", group: "Space" },
  { key: "fa-globe", fa: "fa-globe", label: "Globe", group: "Space" },
  { key: "fa-earth-americas", fa: "fa-earth-americas", label: "Earth", group: "Space" },
  { key: "fa-flask", fa: "fa-flask", label: "Flask / Lab", group: "Space" },
  { key: "fa-atom", fa: "fa-atom", label: "Atom", group: "Space" },
  { key: "fa-dna", fa: "fa-dna", label: "DNA", group: "Space" },
  { key: "fa-microscope", fa: "fa-microscope", label: "Microscope", group: "Space" },
  { key: "fa-binoculars", fa: "fa-binoculars", label: "Telescope / Explore", group: "Space" },
  { key: "fa-satellite-dish", fa: "fa-satellite-dish", label: "Satellite dish", group: "Space" },
  // tech & code
  { key: "fa-laptop-code", fa: "fa-laptop-code", label: "Laptop code", group: "Tech" },
  { key: "fa-code", fa: "fa-code", label: "Code", group: "Tech" },
  { key: "fa-terminal", fa: "fa-terminal", label: "Terminal", group: "Tech" },
  { key: "fa-server", fa: "fa-server", label: "Server", group: "Tech" },
  { key: "fa-database", fa: "fa-database", label: "Database", group: "Tech" },
  { key: "fa-cloud", fa: "fa-cloud", label: "Cloud", group: "Tech" },
  { key: "fa-cloud-arrow-up", fa: "fa-cloud-arrow-up", label: "Cloud upload", group: "Tech" },
  { key: "fa-wifi", fa: "fa-wifi", label: "WiFi", group: "Tech" },
  { key: "fa-network-wired", fa: "fa-network-wired", label: "Network", group: "Tech" },
  { key: "fa-microchip", fa: "fa-microchip", label: "Microchip / AI", group: "Tech" },
  { key: "fa-robot", fa: "fa-robot", label: "Robot", group: "Tech" },
  { key: "fa-brain", fa: "fa-brain", label: "Brain / AI", group: "Tech" },
  { key: "fa-bug", fa: "fa-bug", label: "Bug", group: "Tech" },
  { key: "fa-mobile-screen", fa: "fa-mobile-screen", label: "Mobile", group: "Tech" },
  { key: "fa-desktop", fa: "fa-desktop", label: "Desktop", group: "Tech" },
  { key: "fa-camera", fa: "fa-camera", label: "Camera", group: "Tech" },
  { key: "fa-gamepad", fa: "fa-gamepad", label: "Gamepad", group: "Tech" },
  { key: "fa-vr-cardboard", fa: "fa-vr-cardboard", label: "VR", group: "Tech" },
  { key: "fa-cube", fa: "fa-cube", label: "3D Cube", group: "Tech" },
  { key: "fa-cubes", fa: "fa-cubes", label: "3D Cubes", group: "Tech" },
  { key: "fa-layer-group", fa: "fa-layer-group", label: "Layers", group: "Tech" },
  { key: "fa-plug", fa: "fa-plug", label: "Plug", group: "Tech" },
  { key: "fa-bolt", fa: "fa-bolt", label: "Bolt / Energy", group: "Tech" },
  { key: "fa-battery-full", fa: "fa-battery-full", label: "Battery", group: "Tech" },
  // security
  { key: "fa-shield-halved", fa: "fa-shield-halved", label: "Shield", group: "Security" },
  { key: "fa-lock", fa: "fa-lock", label: "Lock", group: "Security" },
  { key: "fa-unlock", fa: "fa-unlock", label: "Unlock", group: "Security" },
  { key: "fa-key", fa: "fa-key", label: "Key", group: "Security" },
  { key: "fa-user-shield", fa: "fa-user-shield", label: "User shield", group: "Security" },
  { key: "fa-user-lock", fa: "fa-user-lock", label: "User lock", group: "Security" },
  { key: "fa-fingerprint", fa: "fa-fingerprint", label: "Fingerprint", group: "Security" },
  { key: "fa-eye", fa: "fa-eye", label: "Eye", group: "Security" },
  { key: "fa-mask", fa: "fa-mask", label: "Spy / Privacy", group: "Security" },
  { key: "fa-user-secret", fa: "fa-user-secret", label: "Agent", group: "Security" },
  { key: "fa-sitemap", fa: "fa-sitemap", label: "Sitemap", group: "Security" },
  // business
  { key: "fa-briefcase", fa: "fa-briefcase", label: "Briefcase", group: "Business" },
  { key: "fa-building", fa: "fa-building", label: "Building", group: "Business" },
  { key: "fa-chart-line", fa: "fa-chart-line", label: "Chart line", group: "Business" },
  { key: "fa-chart-pie", fa: "fa-chart-pie", label: "Chart pie", group: "Business" },
  { key: "fa-coins", fa: "fa-coins", label: "Coins", group: "Business" },
  { key: "fa-money-bill-wave", fa: "fa-money-bill-wave", label: "Money", group: "Business" },
  { key: "fa-handshake", fa: "fa-handshake", label: "Handshake", group: "Business" },
  { key: "fa-users", fa: "fa-users", label: "Team", group: "Business" },
  { key: "fa-user-tie", fa: "fa-user-tie", label: "Manager", group: "Business" },
  { key: "fa-graduation-cap", fa: "fa-graduation-cap", label: "Graduate", group: "Business" },
  { key: "fa-certificate", fa: "fa-certificate", label: "Certificate", group: "Business" },
  { key: "fa-award", fa: "fa-award", label: "Award", group: "Business" },
  { key: "fa-trophy", fa: "fa-trophy", label: "Trophy", group: "Business" },
  { key: "fa-medal", fa: "fa-medal", label: "Medal", group: "Business" },
  { key: "fa-signature", fa: "fa-signature", label: "Signature", group: "Business" },
  { key: "fa-id-badge", fa: "fa-id-badge", label: "ID badge", group: "Business" },
  // media & design
  { key: "fa-palette", fa: "fa-palette", label: "Palette", group: "Design" },
  { key: "fa-brush", fa: "fa-brush", label: "Brush", group: "Design" },
  { key: "fa-pen-nib", fa: "fa-pen-nib", label: "Pen nib", group: "Design" },
  { key: "fa-pen", fa: "fa-pen", label: "Pen", group: "Design" },
  { key: "fa-wand-magic-sparkles", fa: "fa-wand-magic-sparkles", label: "Magic", group: "Design" },
  { key: "fa-shapes", fa: "fa-shapes", label: "Shapes", group: "Design" },
  { key: "fa-compass-drafting", fa: "fa-compass-drafting", label: "Drafting", group: "Design" },
  { key: "fa-scissors", fa: "fa-scissors", label: "Scissors", group: "Design" },
  { key: "fa-image", fa: "fa-image", label: "Image", group: "Design" },
  { key: "fa-photo-film", fa: "fa-photo-film", label: "Gallery", group: "Design" },
  { key: "fa-film", fa: "fa-film", label: "Film", group: "Design" },
  { key: "fa-video", fa: "fa-video", label: "Video", group: "Design" },
  { key: "fa-music", fa: "fa-music", label: "Music", group: "Design" },
  { key: "fa-headphones", fa: "fa-headphones", label: "Headphones", group: "Design" },
  { key: "fa-microphone", fa: "fa-microphone", label: "Microphone", group: "Design" },
  { key: "fa-font", fa: "fa-font", label: "Typography", group: "Design" },
  // communication
  { key: "fa-envelope", fa: "fa-envelope", label: "Envelope", group: "Contact" },
  { key: "fa-paper-plane", fa: "fa-paper-plane", label: "Send", group: "Contact" },
  { key: "fa-phone", fa: "fa-phone", label: "Phone", group: "Contact" },
  { key: "fa-comment-dots", fa: "fa-comment-dots", label: "Chat", group: "Contact" },
  { key: "fa-comments", fa: "fa-comments", label: "Comments", group: "Contact" },
  { key: "fa-at", fa: "fa-at", label: "At / Email", group: "Contact" },
  { key: "fa-link", fa: "fa-link", label: "Link", group: "Contact" },
  { key: "fa-share-nodes", fa: "fa-share-nodes", label: "Share", group: "Contact" },
  { key: "fa-rss", fa: "fa-rss", label: "RSS / Blog", group: "Contact" },
  { key: "fa-newspaper", fa: "fa-newspaper", label: "News", group: "Contact" },
  { key: "fa-book", fa: "fa-book", label: "Book", group: "Contact" },
  { key: "fa-quote-left", fa: "fa-quote-left", label: "Quote", group: "Contact" },
  // nature & life
  { key: "fa-leaf", fa: "fa-leaf", label: "Leaf", group: "Nature" },
  { key: "fa-seedling", fa: "fa-seedling", label: "Seedling", group: "Nature" },
  { key: "fa-tree", fa: "fa-tree", label: "Tree", group: "Nature" },
  { key: "fa-paw", fa: "fa-paw", label: "Paw", group: "Nature" },
  { key: "fa-feather", fa: "fa-feather", label: "Feather", group: "Nature" },
  { key: "fa-mountain-sun", fa: "fa-mountain-sun", label: "Mountain", group: "Nature" },
  { key: "fa-water", fa: "fa-water", label: "Water", group: "Nature" },
  { key: "fa-snowflake", fa: "fa-snowflake", label: "Snowflake", group: "Nature" },
  { key: "fa-fire", fa: "fa-fire", label: "Fire", group: "Nature" },
  { key: "fa-wind", fa: "fa-wind", label: "Wind", group: "Nature" },
  // status & misc
  { key: "fa-circle-check", fa: "fa-circle-check", label: "Check", group: "Misc" },
  { key: "fa-circle-xmark", fa: "fa-circle-xmark", label: "Cross", group: "Misc" },
  { key: "fa-circle-info", fa: "fa-circle-info", label: "Info", group: "Misc" },
  { key: "fa-circle-question", fa: "fa-circle-question", label: "Question", group: "Misc" },
  { key: "fa-bell", fa: "fa-bell", label: "Bell", group: "Misc" },
  { key: "fa-clock", fa: "fa-clock", label: "Clock", group: "Misc" },
  { key: "fa-calendar-days", fa: "fa-calendar-days", label: "Calendar", group: "Misc" },
  { key: "fa-map-location-dot", fa: "fa-map-location-dot", label: "Map", group: "Misc" },
  { key: "fa-location-dot", fa: "fa-location-dot", label: "Pin", group: "Misc" },
  { key: "fa-compass", fa: "fa-compass", label: "Compass", group: "Misc" },
  { key: "fa-flag", fa: "fa-flag", label: "Flag", group: "Misc" },
  { key: "fa-lightbulb", fa: "fa-lightbulb", label: "Idea", group: "Misc" },
  { key: "fa-gear", fa: "fa-gear", label: "Gear", group: "Misc" },
  { key: "fa-wrench", fa: "fa-wrench", label: "Wrench", group: "Misc" },
  { key: "fa-screwdriver-wrench", fa: "fa-screwdriver-wrench", label: "Tools", group: "Misc" },
  { key: "fa-mug-hot", fa: "fa-mug-hot", label: "Coffee", group: "Misc" },
  { key: "fa-utensils", fa: "fa-utensils", label: "Food", group: "Misc" },
  { key: "fa-heart-pulse", fa: "fa-heart-pulse", label: "Health", group: "Misc" },
  { key: "fa-gift", fa: "fa-gift", label: "Gift", group: "Misc" },
  { key: "fa-thumbtack", fa: "fa-thumbtack", label: "Thumbtack", group: "Misc" },
  { key: "fa-ban", fa: "fa-ban", label: "Ban", group: "Misc" },
  { key: "fa-spinner", fa: "fa-spinner", label: "Spinner", group: "Misc" },
  { key: "fa-arrow-trend-up", fa: "fa-arrow-trend-up", label: "Trend up", group: "Misc" },
  { key: "fa-bullseye", fa: "fa-bullseye", label: "Target", group: "Misc" },
];

export const ALL_LIBRARY_ICONS: LibraryIcon[] = [...LUCIDE_ICONS, ...FA_ICONS];

export function isFaIcon(key: string | undefined): boolean {
  return !!key && key.startsWith("fa-");
}

/** Uploaded icons are persisted as `media:/api/uploads/<id>` keys. */
export function customMediaIconUrl(key: string | undefined): string | undefined {
  if (!key?.startsWith("media:")) return undefined;
  const url = key.slice("media:".length);
  return /^\/api\/uploads\/[a-zA-Z0-9_-]+$/.test(url) ? url : undefined;
}

export function findLibraryIcon(key: string | undefined): LibraryIcon | undefined {
  return ALL_LIBRARY_ICONS.find((i) => i.key === key);
}
