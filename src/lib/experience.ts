import type { BuilderConfig, ExplorerChapterConfig, ExplorerConfig } from "@/lib/content-types";

export type ResolvedExplorerChapter = ExplorerChapterConfig & { target: string };

function chapterTarget(id: string, anchor: string) {
  if (id === "hero") return "home";
  if (id === "footer") return "contact";
  return anchor || id;
}

function fallbackIcon(id: string) {
  if (id === "hero") return "rocket";
  if (id === "timeline") return "timeline";
  if (id === "footer") return "trophy";
  if (id === "security") return "map";
  return "sparkles";
}

export function resolveExplorerChapters(config: ExplorerConfig, builder: BuilderConfig): ResolvedExplorerChapter[] {
  const overrides = new Map(config.chapters.map((chapter) => [chapter.id, chapter]));
  if (!config.autoSync) {
    return config.chapters
      .filter((chapter) => chapter.enabled !== false)
      .map((chapter) => ({ ...chapter, target: chapterTarget(chapter.id, "") }));
  }

  return builder.sections
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .filter((section) => section.enabled !== false)
    .map((section) => {
      const override = overrides.get(section.id);
      return {
        id: section.id,
        target: chapterTarget(section.id, section.anchor),
        title: override?.title || section.label || section.id,
        clue: override?.clue || section.label || section.id,
        color: override?.color || section.accent || "#8b5cf6",
        icon: override?.icon || fallbackIcon(section.id),
        enabled: override?.enabled !== false,
      };
    })
    .filter((chapter) => chapter.enabled && chapter.target);
}
