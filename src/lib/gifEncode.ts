import { decodeGif } from "./gifDecoder";
import { fitDimensions, medianCutQuantize } from "./imageProcessing";

// gif.js (loaded globally via <Script> in the app, see GifEncoderScript)
// exposes window.GIF — there's no npm/ESM build we control the shape of,
// so it's typed loosely here rather than importing a third-party .d.ts.
interface GifJsInstance {
  addFrame: (source: CanvasRenderingContext2D, opts: { copy: boolean; delay: number }) => void;
  render: () => void;
  on: (event: "finished", cb: (blob: Blob) => void) => void;
}
interface GifJsInstanceEvents extends GifJsInstance {
  on(event: "finished", cb: (blob: Blob) => void): void;
  on(event: "abort", cb: () => void): void;
}
type GifJsConstructor = new (opts: {
  workers: number;
  quality: number;
  width: number;
  height: number;
  workerScript: string;
}) => GifJsInstanceEvents;

declare global {
  interface Window {
    GIF?: GifJsConstructor;
  }
}

// Browsers refuse to construct a cross-origin Worker directly from a CDN
// URL (same-origin policy applies to worker scripts, not just
// fetch/XHR) — gif.js needs its worker script handed to it as a real
// URL, so this fetches the CDN file once, wraps it in a same-origin Blob
// URL, and reuses that for every GIF processed in this session.
let gifWorkerBlobUrlPromise: Promise<string> | null = null;
function getGifWorkerUrl(): Promise<string> {
  if (!gifWorkerBlobUrlPromise) {
    gifWorkerBlobUrlPromise = fetch("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js")
      .then((res) => res.blob())
      .then((blob) => URL.createObjectURL(blob));
  }
  return gifWorkerBlobUrlPromise;
}

// The gif.js <Script> tag loads async relative to React hydration — a
// user can click Compress on a GIF before window.GIF exists yet. Poll
// briefly instead of failing immediately, so a slow network doesn't turn
// into an unrecoverable-until-Retry error for what is really just normal
// script-loading latency.
async function waitForGifJs(timeoutMs = 8000): Promise<GifJsConstructor> {
  const start = Date.now();
  while (!window.GIF) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("GIF encoder failed to load. Check your connection and try again.");
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return window.GIF;
}

export interface GifCompressOptions {
  maxWidth: number | null;
  maxHeight: number | null;
  colorCount: number;
}

export interface GifCompressResult {
  blob: Blob;
}

export async function compressGif(file: File, options: GifCompressOptions): Promise<GifCompressResult> {
  const GIF = await waitForGifJs();
  const { maxWidth, maxHeight, colorCount } = options;

  const buffer = await file.arrayBuffer();
  const { width: srcW, height: srcH, frames } = decodeGif(buffer);
  const { width, height } = fitDimensions(srcW, srcH, maxWidth, maxHeight);

  // Each GIF frame only carries the pixels that changed from the last one
  // (per its own left/top/width/height), not a full new image —
  // compositing them in order onto one persistent canvas is what
  // actually reconstructs each full frame instead of a flickering diff.
  const composeCanvas = document.createElement("canvas");
  composeCanvas.width = srcW;
  composeCanvas.height = srcH;
  const composeCtx = composeCanvas.getContext("2d")!;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d")!;

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width,
    height,
    workerScript: await getGifWorkerUrl(),
  });

  for (const frame of frames) {
    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = frame.width;
    patchCanvas.height = frame.height;
    patchCanvas.getContext("2d")!.putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0);
    composeCtx.drawImage(patchCanvas, frame.left, frame.top);

    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(composeCanvas, 0, 0, srcW, srcH, 0, 0, width, height);

    if (colorCount < 256) {
      const imageData = outCtx.getImageData(0, 0, width, height);
      outCtx.putImageData(medianCutQuantize(imageData, colorCount), 0, 0);
    }

    gif.addFrame(outCtx, { copy: true, delay: (frame.delay || 10) * 10 });

    // Disposal method 2 ("restore to background") clears just this
    // frame's region before the next one composites — anything else
    // (0/1 "do not dispose", 3 "restore to previous") leaves the canvas
    // as-is, which is the correct default for both.
    if (frame.disposal === 2) {
      composeCtx.clearRect(frame.left, frame.top, frame.width, frame.height);
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    gif.on("finished", resolve);
    gif.on("abort", () => reject(new Error("GIF encoding aborted")));
    gif.render();
  });

  return { blob };
}
