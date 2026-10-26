"use client";

import { OrbitalLoader } from "@/components/portfolio/orbital-loader";
import { useContent } from "@/lib/content-store";

export default function Loading() {
  const lang = useContent((state) => state.lang);
  return <OrbitalLoader fullScreen lang={lang} />;
}
