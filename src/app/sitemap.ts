import type { MetadataRoute } from "next";

// Single-page portfolio — one canonical URL. Sections are in-page anchors.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.P00RIJA_PUBLIC_URL || "http://localhost:3000";
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
