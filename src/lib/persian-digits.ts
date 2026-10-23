/* Persian (۰-۹) and Arabic-Indic (٠-٩) digit normalization.
 * Persian keyboards produce non-ASCII digits that fail /^\d/ PIN
 * validation on both the client and the server. Every PIN field and
 * every PIN comparison normalizes through here so «۷۳۰۴» == "7304".
 * Pure module — safe for client bundles and the proxy. */

const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** Replace all Persian/Arabic-Indic digits with ASCII equivalents. */
export function normalizeDigits(input: string): string {
  if (!input) return input;
  return input.replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d] ?? d);
}
