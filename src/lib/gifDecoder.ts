// ---------- GIF decoding (GIF89a) ----------
// Animated GIFs can't go through the Canvas API the way JPEG/PNG/WebP
// do — there's no canvas.toBlob('image/gif'), and <img>/drawImage only
// exposes the first frame, not each frame's own timing/disposal data.
// Re-encoding one means decoding every frame ourselves. No CDN library
// ships a real browser-ready bundle for this (checked: gifuct-js is
// CommonJS-only with its own unbundled sub-dependencies), so this is a
// small decoder written directly against the GIF89a spec — header,
// optional global color table, then a stream of blocks (extensions and
// image descriptors) until the 0x3B trailer.
//
// Ported 1:1 from the original static-site implementation (app.js) with
// no behavior changes, only type annotations.

export interface GifFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  delay: number;
  disposal: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

export interface DecodedGif {
  width: number;
  height: number;
  frames: GifFrame[];
}

type RGB = [number, number, number];

// Decoded frames are rasterized to a Uint8ClampedArray of width*height*4
// bytes. A corrupt header claiming an enormous canvas (e.g. 0xFFFF x 0xFFFF)
// would otherwise try to allocate multiple gigabytes per frame before any
// real pixel data is even read. Cap at 64 megapixels (comfortably above any
// real-world GIF, e.g. an 8000x8000 image) to fail fast instead.
const MAX_GIF_PIXELS = 64 * 1024 * 1024;

export function decodeGif(buffer: ArrayBuffer): DecodedGif {
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  // Every read is bounds-checked against the buffer length: past EOF these
  // used to return `undefined`, which silently poisons `pos` (pos++ on
  // undefined becomes NaN) and turns loop conditions like `pos < bytes.length`
  // permanently false-negative — i.e. an infinite loop on truncated input.
  // Throwing here instead makes truncated/malformed GIFs fail fast.
  const readByte = () => {
    if (pos >= bytes.length) throw new Error("Unexpected end of GIF data");
    return bytes[pos++];
  };
  const readU16 = () => {
    if (pos + 1 >= bytes.length) throw new Error("Unexpected end of GIF data");
    const v = bytes[pos] | (bytes[pos + 1] << 8);
    pos += 2;
    return v;
  };

  if (bytes.length < 6) throw new Error("Not a GIF file");
  const sig = String.fromCharCode(...bytes.slice(0, 6));
  if (sig !== "GIF87a" && sig !== "GIF89a") throw new Error("Not a GIF file");
  pos = 6;

  const width = readU16();
  const height = readU16();
  if (width * height > MAX_GIF_PIXELS) {
    throw new Error("GIF dimensions too large");
  }
  const packed = readByte();
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = 2 ** ((packed & 0x07) + 1);
  readByte(); // background color index — unused, every frame carries its own pixels
  readByte(); // pixel aspect ratio — unused

  function readColorTable(size: number): RGB[] {
    const table: RGB[] = [];
    for (let i = 0; i < size; i++) table.push([readByte(), readByte(), readByte()]);
    return table;
  }
  const gct = gctFlag ? readColorTable(gctSize) : null;

  // Sub-blocks: a length-prefixed run of byte chunks terminated by a
  // zero-length block — the same framing GIF uses for both LZW image
  // data and extension payloads (comments, application data, etc).
  function readSubBlocks(): Uint8Array {
    const chunks: Uint8Array[] = [];
    let len: number;
    while ((len = readByte()) !== 0) {
      if (pos + len > bytes.length) throw new Error("Unexpected end of GIF data");
      chunks.push(bytes.slice(pos, pos + len));
      pos += len;
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }

  // Variable-width LZW decompression per the GIF spec: codes start at
  // minCodeSize+1 bits, the dictionary grows as codes are read, a clear
  // code (2^minCodeSize) resets it, and an end code (clear+1) stops.
  function lzwDecode(minCodeSize: number, data: Uint8Array): number[] {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let dict: (number[] | null)[] = [];
    let next = 0;
    function resetDict() {
      dict = [];
      for (let i = 0; i < clearCode; i++) dict[i] = [i];
      dict[clearCode] = null;
      dict[eoiCode] = null;
      next = eoiCode + 1;
      codeSize = minCodeSize + 1;
    }
    resetDict();

    const output: number[] = [];
    let bitBuf = 0;
    let bitCount = 0;
    let di = 0;
    let prev: number[] | null = null;

    function nextCode(): number | null {
      while (bitCount < codeSize) {
        if (di >= data.length) return null;
        bitBuf |= data[di++] << bitCount;
        bitCount += 8;
      }
      const code = bitBuf & ((1 << codeSize) - 1);
      bitBuf >>= codeSize;
      bitCount -= codeSize;
      return code;
    }

    let code: number | null;
    while ((code = nextCode()) !== null) {
      if (code === clearCode) {
        resetDict();
        prev = null;
        continue;
      }
      if (code === eoiCode) break;

      let entry: number[];
      if (code < next && dict[code]) entry = dict[code]!;
      else if (code === next && prev) entry = prev.concat(prev[0]);
      else break; // malformed stream — stop rather than throw away the whole image

      for (const px of entry) output.push(px);

      if (prev) {
        dict[next++] = prev.concat(entry[0]);
        if (next === 1 << codeSize && codeSize < 12) codeSize++;
      }
      prev = entry;
    }
    return output;
  }

  // De-interlacing per the GIF spec: four passes at increasing density
  // (every 8th row, then 8th offset by 4, then every 4th offset by 2,
  // then every 2nd offset by 1) rather than top-to-bottom order.
  function deinterlace(pixels: number[], w: number, h: number): number[] {
    const result: number[] = new Array(w * h);
    const passes: [number, number][] = [
      [0, 8],
      [4, 8],
      [2, 4],
      [1, 2],
    ];
    let srcRow = 0;
    for (const [start, step] of passes) {
      for (let row = start; row < h; row += step) {
        for (let col = 0; col < w; col++) result[row * w + col] = pixels[srcRow * w + col];
        srcRow++;
      }
    }
    return result;
  }

  const frames: GifFrame[] = [];
  let gcDelay = 10;
  let gcTransparentIndex = -1;
  let gcDisposal = 0;

  while (pos < bytes.length) {
    const blockType = readByte();
    if (blockType === 0x3b) break; // trailer
    if (blockType === 0x21) {
      // Extension block: only Graphic Control (0xF9) carries data this
      // decoder needs (delay/disposal/transparency) — everything else
      // (comments, application extensions like NETSCAPE2.0 looping) is
      // read past and discarded, since it doesn't affect a single
      // re-encoded pass through every frame.
      const label = readByte();
      if (label === 0xf9) {
        readByte(); // block size — always 4 for this extension, nothing more to skip
        const gcPacked = readByte();
        gcDisposal = (gcPacked >> 2) & 0x07;
        const transparentFlag = (gcPacked & 0x01) !== 0;
        gcDelay = readU16();
        const transparentIndex = readByte();
        gcTransparentIndex = transparentFlag ? transparentIndex : -1;
        readByte(); // block terminator
      } else {
        readSubBlocks();
      }
      continue;
    }
    if (blockType === 0x2c) {
      const left = readU16();
      const top = readU16();
      const w = readU16();
      const h = readU16();
      if (w * h > MAX_GIF_PIXELS) throw new Error("GIF frame dimensions too large");
      const imgPacked = readByte();
      const lctFlag = (imgPacked & 0x80) !== 0;
      const interlaced = (imgPacked & 0x40) !== 0;
      const lctSize = 2 ** ((imgPacked & 0x07) + 1);
      const lct = lctFlag ? readColorTable(lctSize) : null;
      const minCodeSize = readByte();
      const lzwData = readSubBlocks();

      let indices = lzwDecode(minCodeSize, lzwData);
      if (indices.length < w * h) {
        // Truncated/corrupt frame data — pad with transparent/background
        // rather than throw the whole GIF away over one bad frame.
        indices = indices.concat(
          new Array(w * h - indices.length).fill(gcTransparentIndex >= 0 ? gcTransparentIndex : 0)
        );
      }
      if (interlaced) indices = deinterlace(indices, w, h);

      const palette = lct || gct || [[0, 0, 0] as RGB];
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        const idx = indices[i];
        const color = palette[idx] || [0, 0, 0];
        const isTransparent = idx === gcTransparentIndex;
        rgba[i * 4] = color[0];
        rgba[i * 4 + 1] = color[1];
        rgba[i * 4 + 2] = color[2];
        rgba[i * 4 + 3] = isTransparent ? 0 : 255;
      }

      frames.push({ left, top, width: w, height: h, delay: gcDelay, disposal: gcDisposal, rgba });
      gcDelay = 10;
      gcTransparentIndex = -1;
      gcDisposal = 0;
      continue;
    }
    // Unknown block type — bail rather than loop forever on corrupt data.
    break;
  }

  if (!frames.length) throw new Error("No frames found in GIF");
  return { width, height, frames };
}
