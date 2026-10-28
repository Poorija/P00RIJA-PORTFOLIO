import { imageToAsciiFrame, renderFrameToCanvas, type AsciiOptions } from "asciify-engine";

export function renderContainedAsciiImage(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  options: AsciiOptions,
) {
  const bounds = host.getBoundingClientRect();
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (bounds.width < 1 || bounds.height < 1 || !sourceWidth || !sourceHeight) return false;

  const fit = Math.min(bounds.width / sourceWidth, bounds.height / sourceHeight);
  const cssWidth = Math.max(1, Math.floor(sourceWidth * fit));
  const cssHeight = Math.max(1, Math.floor(sourceHeight * fit));
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5, 1600 / Math.max(cssWidth, cssHeight));
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const { frame } = imageToAsciiFrame(image, options, width, height);
  if (!frame.length || !frame[0]?.length) return false;
  const context = canvas.getContext("2d");
  if (!context) return false;
  renderFrameToCanvas(context, frame, options, width, height);
  return true;
}
