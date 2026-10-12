import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

async function gscVerificationToken(): Promise<string | undefined> {
  try {
    const { getContent } = await import("@/lib/content-cache");
    const content = await getContent();
    const token = (content.en?.builder as { analytics?: { gscVerification?: string } } | undefined)
      ?.analytics?.gscVerification
      ?? (content.fa?.builder as { analytics?: { gscVerification?: string } } | undefined)
        ?.analytics?.gscVerification;
    return token?.trim() || undefined;
  } catch {
    return undefined;
  }
}

// CMS-managed metadata (PWA icons incl. apple-touch-icon, GSC verification)
// must reflect live database content — never bake it at build time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const google = await gscVerificationToken();
  // CMS-managed PWA icons (apple-touch drives the iOS home-screen icon).
  let pwaIcons: Metadata["icons"] | undefined;
  let seo: Record<string, string | boolean> = {};
  try {
    const { getContentSection } = await import("@/lib/content-cache");
    const container = await getContentSection("pwa");
    const en = (container?.en ?? {}) as Record<string, string | undefined>;
    const fa = (container?.fa ?? {}) as Record<string, string | undefined>;
    const pick = (key: string) => en[key]?.trim() || fa[key]?.trim() || "";
    const apple = pick("appleTouchIcon");
    const shortcut = pick("icon192") || pick("iconSvg") || "/logo.svg";
    pwaIcons = {
      icon: [{ url: shortcut }],
      apple: apple ? [{ url: apple }] : undefined,
    };
    // SEO section (global, en first with fa fallback per field).
    const seoContainer = await getContentSection("seo");
    const seoEn = (seoContainer?.en ?? {}) as Record<string, string | boolean>;
    const seoFa = (seoContainer?.fa ?? {}) as Record<string, string | boolean>;
    for (const key of new Set([...Object.keys(seoEn), ...Object.keys(seoFa)])) {
      const v = seoEn[key] ?? seoFa[key];
      if (v !== "" && v != null) seo[key] = v as string | boolean;
    }
  } catch {
    pwaIcons = undefined;
  }
  const S = (key: string, fallback = "") => (typeof seo[key] === "string" && seo[key] ? String(seo[key]) : fallback);
  const noindex = seo.noindexDev === true && process.env.NODE_ENV !== "production";
  const robots = noindex
    ? { index: false, follow: false }
    : S("robots", "index, follow").includes("noindex")
      ? { index: false, follow: !S("robots").includes("nofollow") }
      : { index: true, follow: true };
  const canonical = S("canonicalHost").replace(/\/+$/, "");
  return {
  title: S("metaTitle", "Portfolio | Graphics · Security · AI"),
  description: S(
    "metaDescription",
    "A creative multi-disciplinary portfolio — at the intersection of graphic design, Linux network security, and artificial intelligence."
  ),
  keywords: S("keywords").split(",").map((k) => k.trim()).filter(Boolean),
  authors: [{ name: S("authorName", "Portfolio") }],
  applicationName: "P00RIJA Portfolio",
  ...(canonical ? { metadataBase: new URL(canonical), alternates: { canonical: "/" } } : {}),
  robots,
  ...(pwaIcons ? { icons: pwaIcons } : {}),
  openGraph: {
    title: S("metaTitle", "P00RIJA — Graphics · Security · AI"),
    description: S("metaDescription", "One creator, three worlds: design, Linux network security and artificial intelligence — in an interactive 3D portfolio."),
    type: "website",
    siteName: "P00RIJA Portfolio",
    ...(S("ogImage") ? { images: [{ url: S("ogImage") }] } : {}),
  },
  twitter: {
    card: S("twitterCard", "summary_large_image") as "summary" | "summary_large_image",
    title: S("metaTitle", "P00RIJA — Graphics · Security · AI"),
    description: S("metaDescription", "One creator, three worlds: design, security and AI in an interactive 3D portfolio."),
    ...(S("ogImage") ? { images: [S("ogImage")] } : {}),
  },
  ...(google ? { verification: { google } } : {}),
  };
}

export const viewport = {
  themeColor: "#0a0a12",
  width: "device-width",
  initialScale: 1,
} as const;

/** Person JSON-LD from the CMS seo + developer content (nullable output). */
async function jsonLdPerson(): Promise<React.ReactNode> {
  try {
    const { getContentSection } = await import("@/lib/content-cache");
    const seoContainer = await getContentSection("seo");
    const seo = (seoContainer?.en ?? {}) as { jsonldPerson?: boolean };
    if (seo.jsonldPerson === false) return null;
    const dev = (await getContentSection("developer")).en as { name?: string; role?: string; email?: string; github?: string } | undefined;
    if (!dev?.name) return null;
    const graph = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: dev.name,
      jobTitle: dev.role || undefined,
      email: dev.email ? `mailto:${dev.email}` : undefined,
      url: dev.github || undefined,
    };
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />
    );
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        {/* Prevent browser auto-scroll to #hash on page load */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
          window.scrollTo(0, 0);
        `}} />
      </head>
      <body
        suppressHydrationWarning
        className={`${vazirmatn.variable} font-sans antialiased text-foreground overflow-x-hidden`}
      >
        {/* Person JSON-LD (CMS toggle: seo.jsonldPerson) */}
        {await jsonLdPerson()}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-foreground focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider defaultTheme="dark">
          {children}
          <Toaster position="bottom-center" richColors />
        </ThemeProvider>
        {/* Force scroll to top after content loads — prevents auto-scroll to #hash or restored position */}
        <script dangerouslySetInnerHTML={{ __html: `window.scrollTo(0, 0);`}} />
      </body>
    </html>
  );
}
