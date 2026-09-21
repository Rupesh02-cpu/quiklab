// Pure canvas/image utilities shared by the compressor's processing
// pipeline. Ported 1:1 from the original static-site implementation
// (app.js) with no behavior changes, only type annotations.

// Shared aspect-ratio-preserving fit: shrinks width/height to fit within
// maxWidth/maxHeight (either or both may be omitted), never upscales.
// Used by both the canvas image path and the GIF encoder so a future
// change to the resize rule can't apply to one and not the other.
export function fitDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number | null,
  maxHeight: number | null
): { width: number; height: number } {
  let width = srcWidth;
  let height = srcHeight;
  if (maxWidth && width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }
  if (maxHeight && height > maxHeight) {
    width = Math.round(width * (maxHeight / height));
    height = maxHeight;
  }
  return { width, height };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Strips comments, XML/editor metadata, and redundant whitespace from an
// SVG's source text. This is a text-level cleanup (safe, reversible in
// spirit — it changes no visible markup, only removes dead weight editors
// like Illustrator/Figma leave behind), not a full optimizer like SVGO —
// it won't collapse paths or merge shapes, but for the common case of a
// few KB of embedded metadata/comments it's most of the real-world win.
export function minifySvgText(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/\s+xmlns:(dc|cc|rdf|inkscape|sodipodi)="[^"]*"/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Binary-searches JPEG/WebP quality so the result lands at or under a
// target byte size — sharper than picking a fixed quality blind, since it
// finds the highest quality that still fits (see: standard approach for
// "compress to under N KB" tools). PNG is handled separately via
// medianCutQuantize, since its "quality" knob is really palette size.
export async function compressToTarget(
  canvas: HTMLCanvasElement,
  mime: string,
  targetBytes: number
): Promise<Blob> {
  if (mime === "image/png") {
    return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), mime));
  }
  let lo = 0.05;
  let hi = 0.95;
  let best: Blob | null = null;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), mime, mid));
    if (blob.size <= targetBytes) {
      best = blob;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  // Nothing under target was found even at the lowest quality tried —
  // return the lowest-quality attempt rather than nothing, so the user
  // at least gets the smallest result this tool can produce.
  if (!best) {
    best = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), mime, lo));
  }
  return best;
}

interface ColorBucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

// ---------- PNG8 color quantization (median cut) ----------
// PNG's "quality" isn't a lossy knob like JPEG's — canvas.toBlob ignores
// any quality argument for image/png entirely, since PNG is lossless.
// The real compression lever for PNG is palette size: a screenshot, icon,
// or illustration rarely needs all 16.7M RGB colors, and cutting it down
// to a few hundred (or fewer) can shrink the file substantially while
// looking identical, the same technique tools like TinyPNG/pngquant use.
// Implemented as median-cut (Heckbert 1980), but operating on the image's
// UNIQUE colors (weighted by pixel count) rather than every pixel — a
// real photo has far fewer distinct colors than pixels, so this keeps the
// splitting step's working set small regardless of image resolution. The
// final per-pixel mapping is cached by exact RGB value (a Map), so a
// color seen a thousand times in the image only pays the nearest-palette
// search once — without this a 4000x3000 photo would grind for minutes.
export function medianCutQuantize(imageData: ImageData, maxColors: number): ImageData {
  const { data, width, height } = imageData;
  const pixelCount = width * height;

  // Histogram: quantize to 5 bits/channel (32^3 buckets) while building
  // the palette — imperceptible at photo viewing sizes, and cuts the
  // unique-color count (and therefore every step below) dramatically on
  // photos with smooth gradients or sensor noise that would otherwise
  // make almost every pixel "unique".
  const buckets = new Map<number, ColorBucket>();
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const r = data[o] & 0xf8;
    const g = data[o + 1] & 0xf8;
    const b = data[o + 2] & 0xf8;
    const key = (r << 16) | (g << 8) | b;
    const entry = buckets.get(key);
    if (entry) entry.count++;
    else buckets.set(key, { r, g, b, count: 1 });
  }
  const colors = Array.from(buckets.values());

  function boxRange(box: ColorBucket[]): { channel: "r" | "g" | "b"; range: number } {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const c of box) {
      if (c.r < rMin) rMin = c.r;
      if (c.r > rMax) rMax = c.r;
      if (c.g < gMin) gMin = c.g;
      if (c.g > gMax) gMax = c.g;
      if (c.b < bMin) bMin = c.b;
      if (c.b > bMax) bMax = c.b;
    }
    const rRange = rMax - rMin, gRange = gMax - gMin, bRange = bMax - bMin;
    if (rRange >= gRange && rRange >= bRange) return { channel: "r", range: rRange };
    if (gRange >= bRange) return { channel: "g", range: gRange };
    return { channel: "b", range: bRange };
  }

  let boxes: ColorBucket[][] = [colors];
  while (boxes.length < maxColors) {
    let splitIdx = -1;
    let splitInfo: { channel: "r" | "g" | "b"; range: number } | null = null;
    let bestRange = -1;
    boxes.forEach((box, idx) => {
      if (box.length < 2) return;
      const info = boxRange(box);
      if (info.range > bestRange) {
        bestRange = info.range;
        splitIdx = idx;
        splitInfo = info;
      }
    });
    if (splitIdx === -1 || bestRange === 0 || !splitInfo) break;

    const box = boxes[splitIdx];
    const channel = (splitInfo as { channel: "r" | "g" | "b"; range: number }).channel;
    box.sort((a, b) => a[channel] - b[channel]);
    // Split by cumulative pixel count, not entry count, so each half
    // represents roughly equal visual weight in the source image.
    const total = box.reduce((s, c) => s + c.count, 0);
    let acc = 0;
    let mid = 1;
    for (; mid < box.length; mid++) {
      acc += box[mid - 1].count;
      if (acc >= total / 2) break;
    }
    boxes.splice(splitIdx, 1, box.slice(0, mid), box.slice(mid));
  }

  const palette: [number, number, number][] = boxes.map((box) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (const c of box) {
      r += c.r * c.count;
      g += c.g * c.count;
      b += c.b * c.count;
      n += c.count;
    }
    n = n || 1;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });

  const cache = new Map<number, [number, number, number]>();
  function nearestPaletteColor(r: number, g: number, b: number): [number, number, number] {
    const key = (r << 16) | (g << 8) | b;
    const cached = cache.get(key);
    if (cached) return cached;
    let best = 0;
    let bestDist = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const [pr, pg, pb] = palette[p];
      const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    const color = palette[best];
    cache.set(key, color);
    return color;
  }

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const color = nearestPaletteColor(data[o], data[o + 1], data[o + 2]);
    data[o] = color[0];
    data[o + 1] = color[1];
    data[o + 2] = color[2];
  }
  return imageData;
}
