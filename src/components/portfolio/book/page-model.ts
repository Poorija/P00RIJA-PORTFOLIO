import type { ProjectArtwork } from "@/lib/content-types";

export type BookPage = {
  kind: "cover" | "overview" | "process" | "specs" | "image" | "videos" | "links";
  image?: string;
  text?: string;
  part?: string;
  idx?: number;
};

export function buildBookPages(project: ProjectArtwork): BookPage[] {
  const pages: BookPage[] = [];
  const hero = project.featured || project.videos?.[0]?.poster || project.images?.find((image) => /^(https?:|\/|data:)/.test(image)) || "";
  pages.push({ kind: "cover", image: hero });
  const description = (project.description || project.meta || "").trim();
  const chunks: string[] = [];
  for (let index = 0; index < description.length && chunks.length < 8; index += 620) chunks.push(description.slice(index, index + 620));
  if (!chunks.length) chunks.push("");
  chunks.forEach((text, index) => pages.push({ kind: "overview", text, part: chunks.length > 1 ? `${index + 1}/${chunks.length}` : "" }));
  const processEntries = (project.process ?? []).filter((entry) => entry?.title);
  for (let index = 0; index < processEntries.length; index += 6) pages.push({ kind: "process", idx: index / 6, part: processEntries.length > 6 ? `${index / 6 + 1}/${Math.ceil(processEntries.length / 6)}` : "" });
  const specs = project.specs ?? [];
  for (let index = 0; index < specs.length; index += 12) pages.push({ kind: "specs", idx: index / 12, part: specs.length > 12 ? `${index / 12 + 1}/${Math.ceil(specs.length / 12)}` : "" });
  for (const image of (project.images ?? []).filter((item) => /^(https?:|\/|data:)/.test(item)).slice(0, 12)) pages.push({ kind: "image", image });
  if (project.videos?.length) pages.push({ kind: "videos" });
  if ([...(project.links ?? []), ...(project.link ? [{ label: "", url: project.link, kind: "live" as const }] : [])].some((link) => link.url)) pages.push({ kind: "links" });
  return pages;
}
