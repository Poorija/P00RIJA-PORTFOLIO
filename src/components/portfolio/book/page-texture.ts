import * as THREE from "three";
import type { ProjectArtwork } from "@/lib/content-types";
import type { BookPage } from "./page-model";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const localizeNumber = (value: number | string, fa: boolean) => fa ? String(value).replace(/\d/g, (digit) => FA_DIGITS[+digit]) : String(value);

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 30) {
  let line = "";
  let lineIndex = 0;
  const paragraphs = text.split("\n");
  for (const paragraph of paragraphs) {
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lineIndex * lineHeight);
        line = word;
        lineIndex++;
        if (lineIndex >= maxLines) return y + lineIndex * lineHeight;
      } else line = test;
    }
    if (line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = "";
      lineIndex++;
    }
    if (lineIndex >= maxLines) break;
  }
  return y + lineIndex * lineHeight;
}

function fitImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, cover: boolean) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
  let dx = x, dy = y, dw = width, dh = height;
  if (cover) {
    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }
  } else if (sourceRatio > targetRatio) {
    dh = width / sourceRatio;
    dy = y + (height - dh) / 2;
  } else {
    dw = height * sourceRatio;
    dx = x + (width - dw) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

export function createBookPageTexture(
  page: BookPage,
  pageIndex: number,
  project: ProjectArtwork,
  lang: "fa" | "en",
  highQuality: boolean,
  onUpdate: () => void,
) {
  const fa = lang === "fa";
  const canvas = document.createElement("canvas");
  canvas.width = highQuality ? 1024 : 640;
  canvas.height = highQuality ? 1408 : 880;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = highQuality ? 8 : 4;
  const images = new Map<string, HTMLImageElement>();
  const accent = project.color || "#8b5cf6";
  const scale = canvas.width / 1024;
  const margin = 82 * scale;
  const contentWidth = canvas.width - margin * 2;

  const loadImage = (source?: string) => {
    if (!source || images.has(source)) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      images.set(source, image);
      draw();
      texture.needsUpdate = true;
      onUpdate();
    };
    image.src = source;
  };
  loadImage(page.image);
  if (page.kind === "videos") loadImage(project.videos?.[0]?.poster);

  const baseFont = (size: number, weight = 400, serif = false) => `${weight} ${size * scale}px ${serif ? "Georgia, " : ""}Vazirmatn, Tahoma, Arial, sans-serif`;
  const heading = (title: string, subtitle?: string) => {
    ctx.fillStyle = "#20242a";
    ctx.font = baseFont(42, 700, true);
    ctx.fillText(title, fa ? canvas.width - margin : margin, 112 * scale, contentWidth);
    ctx.fillStyle = accent;
    ctx.fillRect(fa ? canvas.width - margin - 110 * scale : margin, 142 * scale, 110 * scale, 4 * scale);
    if (subtitle) {
      ctx.fillStyle = "#8b867b";
      ctx.font = baseFont(17);
      ctx.fillText(subtitle, fa ? canvas.width - margin : margin, 178 * scale, contentWidth);
    }
  };
  const paper = () => {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#f6f1e6");
    gradient.addColorStop(0.52, "#f1ebdf");
    gradient.addColorStop(1, "#e8dfcf");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(75,58,35,.025)";
    for (let y = 0; y < canvas.height; y += 7 * scale) ctx.fillRect(0, y, canvas.width, 0.6 * scale);
    const edge = ctx.createLinearGradient(fa ? canvas.width : 0, 0, fa ? canvas.width - 100 * scale : 100 * scale, 0);
    edge.addColorStop(0, "rgba(70,50,25,.16)");
    edge.addColorStop(1, "rgba(70,50,25,0)");
    ctx.fillStyle = edge;
    ctx.fillRect(fa ? canvas.width - 100 * scale : 0, 0, 100 * scale, canvas.height);
    ctx.textAlign = fa ? "right" : "left";
    ctx.textBaseline = "alphabetic";
    ctx.direction = fa ? "rtl" : "ltr";
  };
  const footer = () => {
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillStyle = "#9b9487";
    ctx.font = baseFont(16);
    ctx.fillText(`${localizeNumber(pageIndex + 1, fa)}  ·  P00RIJA / ARCHIVE`, canvas.width / 2, canvas.height - 44 * scale);
    ctx.textAlign = fa ? "right" : "left";
    ctx.direction = fa ? "rtl" : "ltr";
  };
  const drawCover = () => {
    ctx.fillStyle = "#111722";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const image = page.image ? images.get(page.image) : undefined;
    if (image) fitImage(ctx, image, 0, 0, canvas.width, canvas.height, true);
    else {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, accent);
      gradient.addColorStop(0.65, "#172134");
      gradient.addColorStop(1, "#080c13");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const shade = ctx.createLinearGradient(0, canvas.height * 0.25, 0, canvas.height);
    shade.addColorStop(0, "rgba(3,7,13,.05)");
    shade.addColorStop(1, "rgba(3,7,13,.94)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,.24)";
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(32 * scale, 32 * scale, canvas.width - 64 * scale, canvas.height - 64 * scale);
    ctx.textAlign = fa ? "right" : "left";
    ctx.direction = fa ? "rtl" : "ltr";
    const x = fa ? canvas.width - margin : margin;
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.font = baseFont(18, 600);
    ctx.fillText(fa ? "کاتالوگ پروژه / آرشیو مداری" : "PROJECT CATALOGUE / ORBITAL ARCHIVE", x, canvas.height - 360 * scale, contentWidth);
    ctx.fillStyle = "#fff";
    ctx.font = baseFont(project.title.length > 24 ? 52 : 66, 800, true);
    const titleBottom = wrapText(ctx, project.title, x, canvas.height - 275 * scale, contentWidth, 74 * scale, 3);
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = baseFont(23);
    ctx.fillText([project.category, project.year].filter(Boolean).join(" · "), x, titleBottom + 34 * scale, contentWidth);
    ctx.fillStyle = accent;
    ctx.fillRect(fa ? canvas.width - margin - 145 * scale : margin, canvas.height - 100 * scale, 145 * scale, 5 * scale);
  };
  const draw = () => {
    if (page.kind === "cover") {
      drawCover();
      return;
    }
    paper();
    const x = fa ? canvas.width - margin : margin;
    if (page.kind === "overview") {
      heading(fa ? "درباره پروژه" : "About the project", page.part);
      ctx.fillStyle = "#44443f";
      ctx.font = baseFont(25);
      wrapText(ctx, page.text || project.description || project.meta, x, 245 * scale, contentWidth, 44 * scale, 20);
      const details = [project.client, project.role, project.location, project.dates, project.status].filter((detail): detail is string => Boolean(detail));
      ctx.font = baseFont(19, 600);
      ctx.fillStyle = "#716b60";
      details.slice(0, 5).forEach((detail, index) => ctx.fillText(detail, x, canvas.height - (245 - index * 34) * scale, contentWidth));
    } else if (page.kind === "process") {
      heading(fa ? "روند پروژه" : "Project process", page.part);
      const chunk = page.idx ?? 0;
      const entries = (project.process ?? []).filter((entry) => entry?.title).slice(chunk * 6, chunk * 6 + 6);
      let y = 235 * scale;
      entries.forEach((entry) => {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(fa ? canvas.width - margin - 8 * scale : margin + 8 * scale, y - 8 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#32343a";
        ctx.font = baseFont(25, 700);
        ctx.fillText(`${entry.title}${entry.date ? `  ·  ${entry.date}` : ""}`, x, y, contentWidth - 28 * scale);
        ctx.fillStyle = "#69675f";
        ctx.font = baseFont(20);
        y = wrapText(ctx, entry.description || "", x, y + 37 * scale, contentWidth - 28 * scale, 31 * scale, 3) + 45 * scale;
      });
    } else if (page.kind === "specs") {
      heading(fa ? "مشخصات و جزئیات" : "Specifications", page.part);
      const chunk = page.idx ?? 0;
      const entries = (project.specs ?? []).slice(chunk * 12, chunk * 12 + 12);
      entries.forEach((spec, index) => {
        const y = (240 + index * 73) * scale;
        ctx.strokeStyle = "rgba(80,70,55,.17)";
        ctx.lineWidth = scale;
        ctx.beginPath(); ctx.moveTo(margin, y + 25 * scale); ctx.lineTo(canvas.width - margin, y + 25 * scale); ctx.stroke();
        ctx.fillStyle = "#777165";
        ctx.font = baseFont(20);
        ctx.fillText(spec.key, x, y, contentWidth * 0.46);
        ctx.textAlign = fa ? "left" : "right";
        ctx.fillStyle = "#303238";
        ctx.font = baseFont(21, 650);
        ctx.fillText(spec.value, fa ? margin : canvas.width - margin, y, contentWidth * 0.46);
        ctx.textAlign = fa ? "right" : "left";
      });
    } else if (page.kind === "image") {
      heading(project.title, fa ? "تصویر پروژه" : "Project image");
      ctx.fillStyle = "#141922";
      ctx.fillRect(margin, 205 * scale, contentWidth, canvas.height - 340 * scale);
      const image = page.image ? images.get(page.image) : undefined;
      if (image) fitImage(ctx, image, margin + 12 * scale, 217 * scale, contentWidth - 24 * scale, canvas.height - 364 * scale, false);
      else {
        ctx.fillStyle = accent;
        ctx.fillRect(margin, 205 * scale, contentWidth, canvas.height - 340 * scale);
      }
    } else if (page.kind === "videos") {
      heading(fa ? "ویدیوهای پروژه" : "Project videos", fa ? "برای پخش، کنترل ویدیو زیر کتاب را انتخاب کنید" : "Use the video control below the book");
      const poster = project.videos?.[0]?.poster ? images.get(project.videos[0].poster) : undefined;
      ctx.fillStyle = "#111722";
      ctx.fillRect(margin, 230 * scale, contentWidth, 560 * scale);
      if (poster) fitImage(ctx, poster, margin, 230 * scale, contentWidth, 560 * scale, true);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(margin, 230 * scale, contentWidth, 560 * scale);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 5 * scale;
      ctx.beginPath(); ctx.arc(canvas.width / 2, 510 * scale, 65 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 15 * scale, 475 * scale);
      ctx.lineTo(canvas.width / 2 + 35 * scale, 510 * scale);
      ctx.lineTo(canvas.width / 2 - 15 * scale, 545 * scale);
      ctx.fill();
      ctx.fillStyle = "#5f5c55";
      ctx.font = baseFont(23, 600);
      (project.videos ?? []).forEach((video, index) => ctx.fillText(`${localizeNumber(index + 1, fa)}. ${video.label || video.url}`, x, (880 + index * 52) * scale, contentWidth));
    } else if (page.kind === "links") {
      heading(fa ? "پیوندهای پروژه" : "Explore the project", fa ? "لینک‌های قابل کلیک در پنل پایین کتاب" : "Interactive links are available below the book");
      const links = [...(project.links ?? []), ...(project.link ? [{ label: fa ? "مشاهده پروژه" : "View project", url: project.link, kind: "live" as const }] : [])].filter((link) => link.url);
      links.forEach((link, index) => {
        const y = (250 + index * 110) * scale;
        ctx.fillStyle = "rgba(80,65,45,.07)";
        ctx.fillRect(margin, y - 48 * scale, contentWidth, 82 * scale);
        ctx.fillStyle = accent;
        ctx.font = baseFont(28, 700);
        ctx.fillText("↗", fa ? canvas.width - margin - 28 * scale : margin + 28 * scale, y, 50 * scale);
        ctx.fillStyle = "#35373c";
        ctx.font = baseFont(22, 600);
        ctx.fillText(link.label || link.url, x, y, contentWidth - 80 * scale);
      });
    }
    footer();
  };
  draw();
  return texture;
}
