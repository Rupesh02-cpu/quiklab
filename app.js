/* QuikLab — client-side image resize & compress.
   Everything below runs in the browser via the Canvas API.
   No image ever leaves the tab. */

(() => {
  // GA4 custom events for actual tool usage (upload/compress/download),
  // separate from the automatic pageview/scroll events GA already sends.
  // No filenames or image data are ever included, only counts and format.
  function track(eventName, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params || {});
    }
  }

  const dropZone   = document.getElementById('drop');
  const fileInput  = document.getElementById('fileInput');
  const browseBtn  = document.getElementById('browseBtn');
  const framesEl   = document.getElementById('frames');
  const emptyState = document.getElementById('emptyState');

  const qualityEl  = document.getElementById('quality');
  const qualityVal = document.getElementById('qualityVal');
  const maxWidthEl = document.getElementById('maxWidth');
  const maxHeightEl= document.getElementById('maxHeight');
  const formatEl   = document.getElementById('format');

  const sizeModeEl  = document.getElementById('sizeMode');
  const qualityField = document.getElementById('qualityField');
  const targetField  = document.getElementById('targetField');
  const targetSizeEl = document.getElementById('targetSize');
  const targetUnitEl = document.getElementById('targetUnit');
  const colorsEl    = document.getElementById('colors');
  const colorsVal   = document.getElementById('colorsVal');
  const colorsField = document.getElementById('colorsField');

  const processBtn = document.getElementById('processBtn');
  const countBadge = document.getElementById('countBadge');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const clearBtn    = document.getElementById('clearBtn');

  const totalsEl   = document.getElementById('totals');
  const totalBeforeEl = document.getElementById('totalBefore');
  const totalAfterEl  = document.getElementById('totalAfter');
  const totalSaveChip = document.getElementById('totalSaveChip');

  const viewToggle = document.getElementById('viewToggle');

  /** @type {{id:number, file:File, originalUrl:string, originalSize:number,
   *          resultBlob:Blob|null, resultSize:number, resultExt:string, el:HTMLElement}[]} */
  let items = [];
  let nextId = 1;

  // ---------- toast (confirmations + undo) ----------
  const toastStack = document.getElementById('toastStack');
  function showToast(message, { actionLabel, onAction, duration = 4000 } = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-msg"></span>
      ${actionLabel ? `<button type="button" class="toast-action">${actionLabel}</button>` : ''}
    `;
    toast.querySelector('.toast-msg').textContent = message;
    toastStack.appendChild(toast);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 200);
    };

    if (actionLabel && onAction) {
      toast.querySelector('.toast-action').addEventListener('click', () => {
        onAction();
        dismiss();
      });
    }
    setTimeout(dismiss, duration);
  }

  // ---------- theme toggle (System -> Light -> Dark -> System) ----------
  const THEME_KEY = 'quiklab-theme';
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const THEME_ICONS = { system: '#icon-system', light: '#icon-sun', dark: '#icon-moon' };

  function currentTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'system';
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.removeItem(THEME_KEY); } catch {}
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem(THEME_KEY, theme); } catch {}
    }
    themeIcon.querySelector('use').setAttribute('href', THEME_ICONS[theme]);
    themeToggle.setAttribute('aria-label', `Theme: ${theme}. Click to change.`);
  }

  themeToggle.addEventListener('click', () => {
    const next = { system: 'light', light: 'dark', dark: 'system' }[currentTheme()];
    applyTheme(next);
  });

  applyTheme(currentTheme());

  // ---------- save-file ----------
  async function saveFile(filename, data) {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  // ---------- helpers ----------
  const fmtBytes = (n) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  };

  const extFor = (mime) => ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }[mime] || 'jpg');

  const targetMimeFor = (file) => {
    if (file.type === 'image/svg+xml') return 'image/svg+xml';
    const choice = formatEl.value;
    if (choice !== 'original') return choice;
    // keep original type when possible, default to jpeg for anything unrecognized (e.g. avif upload)
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg';
  };

  const refreshButtons = () => {
    const hasItems = items.length > 0;
    processBtn.disabled = !hasItems;
    countBadge.hidden = !hasItems;
    countBadge.textContent = items.length;
    const hasResults = items.some(i => i.resultBlob);
    downloadAllBtn.hidden = !hasResults;
    clearBtn.hidden = !hasItems;
    emptyState.hidden = hasItems;
  };

  const updateTotals = () => {
    const done = items.filter(i => i.resultBlob);
    if (!done.length) { totalsEl.hidden = true; return; }
    const before = done.reduce((s, i) => s + i.originalSize, 0);
    const after  = done.reduce((s, i) => s + i.resultSize, 0);
    const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
    totalsEl.hidden = false;
    totalBeforeEl.textContent = fmtBytes(before);
    totalAfterEl.textContent = fmtBytes(after);
    totalSaveChip.textContent = `${pct >= 0 ? '-' : '+'}${Math.abs(pct)}%`;
  };

  // ---------- rendering a frame ----------
  function renderFrame(item, index) {
    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.innerHTML = `
      <div class="frame-strip"></div>
      <div class="frame-shot">
        <span class="frame-num">${String(index + 1).padStart(2, '0')}</span>
        <img src="${item.originalUrl}" alt="">
        <div class="frame-status" data-role="status">waiting</div>
        <button class="frame-retry" data-role="retry" hidden>
          <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-system"/></svg> Retry
        </button>
      </div>
      <div class="frame-body">
        <div class="frame-name clarity-mask" data-role="fname"></div>
        <div class="frame-sizes">
          <span class="mono">${fmtBytes(item.originalSize)}</span>
          <span class="arrow">→</span>
          <span class="mono after" data-role="afterSize">not yet</span>
        </div>
        <div class="frame-bar"><span data-role="bar" style="width:0%"></span></div>
        <div class="frame-actions">
          <span class="frame-save" data-role="saveTag"></span>
          <button class="frame-dl" data-role="dl" disabled><svg class="icon icon-sm" aria-hidden="true"><use href="#icon-download"/></svg> Download</button>
        </div>
      </div>
    `;
    // Filename is untrusted input (a File's .name can be set to anything by
    // whatever created it — including arbitrary HTML/JS). Never interpolate
    // it into innerHTML: assign it as text/attribute properties instead,
    // which the DOM always treats as literal data, never markup.
    const nameEl = frame.querySelector('[data-role="fname"]');
    nameEl.textContent = item.file.name;
    nameEl.title = item.file.name;

    const dlBtn = frame.querySelector('[data-role="dl"]');
    const dlBtnDefault = dlBtn.innerHTML;
    dlBtn.addEventListener('click', async () => {
      dlBtn.textContent = 'Saving...';
      dlBtn.disabled = true;
      await downloadOne(item);
      dlBtn.innerHTML = dlBtnDefault;
      dlBtn.disabled = false;
    });

    const retryBtn = frame.querySelector('[data-role="retry"]');
    retryBtn.addEventListener('click', () => {
      retryBtn.hidden = true;
      processItem(item).then(() => { refreshButtons(); updateTotals(); });
    });

    item.el = frame;
    framesEl.appendChild(frame);
  }

  function setFrameStatus(item, text, show) {
    const statusEl = item.el.querySelector('[data-role="status"]');
    const retryBtn = item.el.querySelector('[data-role="retry"]');
    statusEl.textContent = text;
    statusEl.style.display = show ? 'flex' : 'none';
    retryBtn.hidden = true;
  }

  function setFrameFailed(item) {
    const statusEl = item.el.querySelector('[data-role="status"]');
    const retryBtn = item.el.querySelector('[data-role="retry"]');
    statusEl.style.display = 'none';
    retryBtn.hidden = false;
  }

  function setFrameResult(item) {
    const afterSizeEl = item.el.querySelector('[data-role="afterSize"]');
    const barEl = item.el.querySelector('[data-role="bar"]');
    const saveTagEl = item.el.querySelector('[data-role="saveTag"]');
    const dlBtn = item.el.querySelector('[data-role="dl"]');

    afterSizeEl.textContent = fmtBytes(item.resultSize);
    const pct = item.originalSize > 0 ? Math.round((1 - item.resultSize / item.originalSize) * 100) : 0;
    const clamped = Math.max(0, Math.min(100, 100 - pct));
    barEl.style.width = `${clamped}%`;
    if (item.keptOriginal) {
      saveTagEl.textContent = 'no gain, original kept';
      const exifNote = item.file.type === 'image/jpeg'
        ? ' Since the original bytes were kept as-is, any EXIF/GPS data in this file was not removed.'
        : '';
      saveTagEl.title = 'Re-encoding this file would have made it larger, so the original bytes were kept instead.' + exifNote;
    } else {
      saveTagEl.textContent = pct >= 0 ? `-${pct}% smaller` : `+${Math.abs(pct)}% larger`;
      saveTagEl.title = item.file.type === 'image/jpeg' ? 'Re-encoding also removes EXIF/GPS metadata from the original photo.' : '';
    }
    dlBtn.disabled = false;
  }

  // ---------- ingest files ----------
  function addFiles(fileList) {
    const files = Array.from(fileList).filter(f => /^image\/(jpeg|png|webp|svg\+xml)$/.test(f.type));
    if (!files.length) return;
    track('upload_images', { file_count: files.length });
    files.forEach(file => {
      const item = {
        id: nextId++,
        file,
        originalUrl: URL.createObjectURL(file),
        originalSize: file.size,
        resultBlob: null,
        resultSize: 0,
        resultExt: 'jpg',
        el: null,
      };
      items.push(item);
      renderFrame(item, items.length - 1);
    });
    refreshButtons();
    updateColorsFieldVisibility();
  }

  // ---------- processing ----------
  function loadImage(url) {
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
  function minifySvgText(text) {
    return text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\?xml[\s\S]*?\?>/g, '')
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
      .replace(/\s+xmlns:(dc|cc|rdf|inkscape|sodipodi)="[^"]*"/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Binary-searches JPEG/WebP quality so the result lands at or under a
  // target byte size — sharper than picking a fixed quality blind, since it
  // finds the highest quality that still fits (see: standard approach for
  // "compress to under N KB" tools). PNG is handled separately via
  // quantizeToColors, since its "quality" knob is really palette size.
  async function compressToTarget(canvas, mime, targetBytes) {
    if (mime === 'image/png') {
      return new Promise(resolve => canvas.toBlob(resolve, mime));
    }
    let lo = 0.05, hi = 0.95, best = null;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, mid));
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
      best = await new Promise(resolve => canvas.toBlob(resolve, mime, lo));
    }
    return best;
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
  function medianCutQuantize(imageData, maxColors) {
    const { data, width, height } = imageData;
    const pixelCount = width * height;

    // Histogram: quantize to 5 bits/channel (32^3 buckets) while building
    // the palette — imperceptible at photo viewing sizes, and cuts the
    // unique-color count (and therefore every step below) dramatically on
    // photos with smooth gradients or sensor noise that would otherwise
    // make almost every pixel "unique".
    const buckets = new Map();
    for (let i = 0; i < pixelCount; i++) {
      const o = i * 4;
      const r = data[o] & 0xF8, g = data[o + 1] & 0xF8, b = data[o + 2] & 0xF8;
      const key = (r << 16) | (g << 8) | b;
      const entry = buckets.get(key);
      if (entry) entry.count++;
      else buckets.set(key, { r, g, b, count: 1 });
    }
    const colors = Array.from(buckets.values());

    function boxRange(box) {
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const c of box) {
        if (c.r < rMin) rMin = c.r; if (c.r > rMax) rMax = c.r;
        if (c.g < gMin) gMin = c.g; if (c.g > gMax) gMax = c.g;
        if (c.b < bMin) bMin = c.b; if (c.b > bMax) bMax = c.b;
      }
      const rRange = rMax - rMin, gRange = gMax - gMin, bRange = bMax - bMin;
      if (rRange >= gRange && rRange >= bRange) return { channel: 'r', range: rRange };
      if (gRange >= bRange) return { channel: 'g', range: gRange };
      return { channel: 'b', range: bRange };
    }

    let boxes = [colors];
    while (boxes.length < maxColors) {
      let splitIdx = -1, splitInfo = null, bestRange = -1;
      boxes.forEach((box, idx) => {
        if (box.length < 2) return;
        const info = boxRange(box);
        if (info.range > bestRange) { bestRange = info.range; splitIdx = idx; splitInfo = info; }
      });
      if (splitIdx === -1 || bestRange === 0) break;

      const box = boxes[splitIdx];
      box.sort((a, b) => a[splitInfo.channel] - b[splitInfo.channel]);
      // Split by cumulative pixel count, not entry count, so each half
      // represents roughly equal visual weight in the source image.
      const total = box.reduce((s, c) => s + c.count, 0);
      let acc = 0, mid = 1;
      for (; mid < box.length; mid++) {
        acc += box[mid - 1].count;
        if (acc >= total / 2) break;
      }
      boxes.splice(splitIdx, 1, box.slice(0, mid), box.slice(mid));
    }

    const palette = boxes.map(box => {
      let r = 0, g = 0, b = 0, n = 0;
      for (const c of box) { r += c.r * c.count; g += c.g * c.count; b += c.b * c.count; n += c.count; }
      n = n || 1;
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    });

    const cache = new Map();
    function nearestPaletteColor(r, g, b) {
      const key = (r << 16) | (g << 8) | b;
      const cached = cache.get(key);
      if (cached) return cached;
      let best = 0, bestDist = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const [pr, pg, pb] = palette[p];
        const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (dist < bestDist) { bestDist = dist; best = p; }
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

  async function processItem(item) {
    setFrameStatus(item, 'compressing...', true);
    try {
      if (item.file.type === 'image/svg+xml') {
        const text = await item.file.text();
        const minified = minifySvgText(text);
        const blob = new Blob([minified], { type: 'image/svg+xml' });
        if (blob.size >= item.originalSize) {
          item.resultBlob = item.file;
          item.resultSize = item.originalSize;
          item.keptOriginal = true;
        } else {
          item.resultBlob = blob;
          item.resultSize = blob.size;
          item.keptOriginal = false;
        }
        item.resultExt = 'svg';
        setFrameStatus(item, '', false);
        setFrameResult(item);
        return;
      }

      const img = await loadImage(item.originalUrl);
      const maxW = parseInt(maxWidthEl.value, 10) || null;
      const maxH = parseInt(maxHeightEl.value, 10) || null;

      let { width, height } = img;
      if (maxW && width > maxW) {
        height = Math.round(height * (maxW / width));
        width = maxW;
      }
      if (maxH && height > maxH) {
        width = Math.round(width * (maxH / height));
        height = maxH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const mime = targetMimeFor(item.file);

      // PNG has no lossy "quality" knob (canvas.toBlob ignores it for PNG
      // entirely) — the real compression lever is how many distinct colors
      // it's allowed to use. Reducing that count is what colorsEl controls;
      // "Full colors" (256... actually the max option) skips this rewrite.
      const colorCount = Number(colorsEl.value);
      if (mime === 'image/png' && colorCount < 256) {
        const imageData = ctx.getImageData(0, 0, width, height);
        ctx.putImageData(medianCutQuantize(imageData, colorCount), 0, 0);
      }

      let blob;
      if (sizeModeEl.value === 'target') {
        const rawTarget = Number(targetSizeEl.value) || 100;
        const targetBytes = targetUnitEl.value === 'MB' ? rawTarget * 1024 * 1024 : rawTarget * 1024;
        blob = await compressToTarget(canvas, mime, targetBytes);
      } else {
        const quality = Math.min(1, Math.max(0.1, Number(qualityEl.value) / 100));
        blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
      }

      // Canvas re-encoding can come back larger than the original — PNG
      // re-encoding ignores the quality slider and can't match a
      // well-optimized encoder, and some JPEGs (e.g. WhatsApp exports with
      // unusual chroma subsampling) re-encode heavier at the same visual
      // quality. A "compressed" file must never be bigger than what the
      // user uploaded, even when a resize/reformat was requested — if the
      // encode came back larger, fall back to the original bytes (resized
      // dimensions are lost in that case, but a smaller-but-wrong-size file
      // is still better than a "compressed" file that's bigger).
      const noGain = blob.size >= item.originalSize;
      if (noGain) {
        item.resultBlob = item.file;
        item.resultSize = item.originalSize;
        item.resultExt = extFor(item.file.type);
        item.keptOriginal = true;
      } else {
        item.resultBlob = blob;
        item.resultSize = blob.size;
        item.resultExt = extFor(mime);
        item.keptOriginal = false;
      }
      item.failed = false;
      setFrameStatus(item, '', false);
      setFrameResult(item);
    } catch (err) {
      console.error(err);
      item.failed = true;
      setFrameFailed(item);
    }
  }

  async function processAll() {
    const processBtnDefault = processBtn.innerHTML;
    processBtn.disabled = true;
    processBtn.textContent = 'Compressing...';
    track('compress_images', { file_count: items.length, mode: sizeModeEl.value, output_format: formatEl.value });
    for (const item of items) {
      await processItem(item);
    }
    processBtn.innerHTML = processBtnDefault;
    processBtn.disabled = false;
    refreshButtons();
    updateTotals();

    const succeeded = items.filter(i => i.resultBlob && !i.failed).length;
    const failed = items.filter(i => i.failed).length;
    if (failed > 0) {
      showToast(`${succeeded} compressed, ${failed} failed. Use Retry on the failed image${failed === 1 ? '' : 's'}.`);
    } else if (succeeded > 0) {
      showToast(`${succeeded} image${succeeded === 1 ? '' : 's'} compressed and ready to download`);
    }
  }

  // ---------- downloads ----------
  function outputName(item) {
    // Strip path separators and control characters from an untrusted
    // filename before it's used as a real output name — a "/" here would
    // silently nest the file into a subfolder inside the generated ZIP,
    // and control characters have no legitimate reason to be in a filename.
    const safeOriginal = item.file.name.replace(/[\/\\\x00-\x1f]/g, '_');
    const base = safeOriginal.replace(/\.[^.]+$/, '') || 'image';
    return `${base}.${item.resultExt}`;
  }

  async function downloadOne(item) {
    if (!item.resultBlob) return;
    track('download_image', { kept_original: !!item.keptOriginal });
    await saveFile(outputName(item), item.resultBlob);
  }

  async function downloadAll() {
    const done = items.filter(i => i.resultBlob);
    if (!done.length) return;
    track('download_all_zip', { file_count: done.length });
    const zip = new JSZip();
    done.forEach(item => zip.file(outputName(item), item.resultBlob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    await saveFile('quiklab-compressed.zip', zipBlob);
  }

  function clearSheet() {
    if (!items.length) return;
    const clearedItems = items;
    const clearedFrames = framesEl.querySelectorAll('.frame');

    items = [];
    clearedFrames.forEach(f => { f.hidden = true; });
    refreshButtons();
    updateTotals();
    updateColorsFieldVisibility();

    let restored = false;
    showToast(`Cleared ${clearedItems.length} image${clearedItems.length === 1 ? '' : 's'}`, {
      actionLabel: 'Undo',
      duration: 5000,
      onAction: () => {
        restored = true;
        items = clearedItems;
        clearedFrames.forEach(f => { f.hidden = false; });
        refreshButtons();
        updateTotals();
        updateColorsFieldVisibility();
      },
    });
    // The undo window has to actually own the delayed cleanup — revoking
    // these object URLs any earlier would blank out the previews while
    // the toast (and undo) is still on screen.
    setTimeout(() => {
      if (restored) return;
      clearedItems.forEach(i => URL.revokeObjectURL(i.originalUrl));
      clearedFrames.forEach(f => f.remove());
    }, 5200);
  }

  // ---------- events ----------
  qualityEl.addEventListener('input', () => { qualityVal.textContent = qualityEl.value; });
  colorsEl.addEventListener('input', () => { colorsVal.textContent = colorsEl.value; });
  sizeModeEl.addEventListener('change', () => {
    const isTarget = sizeModeEl.value === 'target';
    qualityField.hidden = isTarget;
    targetField.hidden = !isTarget;
  });

  // Only worth showing the colors control when the result will actually
  // be a PNG — either explicitly forced, or "Keep original" with at least
  // one PNG in the batch.
  function updateColorsFieldVisibility() {
    const willOutputPng = formatEl.value === 'image/png'
      || (formatEl.value === 'original' && items.some(i => i.file.type === 'image/png'));
    colorsField.hidden = !willOutputPng;
  }
  formatEl.addEventListener('change', updateColorsFieldVisibility);

  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  viewToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    viewToggle.querySelectorAll('.view-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    framesEl.dataset.view = btn.dataset.view;
  });

  ['dragenter', 'dragover'].forEach(evt =>
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag'); })
  );
  dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  processBtn.addEventListener('click', processAll);
  const downloadAllBtnDefault = downloadAllBtn.innerHTML;
  downloadAllBtn.addEventListener('click', async () => {
    downloadAllBtn.textContent = 'Zipping...';
    downloadAllBtn.disabled = true;
    await downloadAll();
    downloadAllBtn.innerHTML = downloadAllBtnDefault;
    downloadAllBtn.disabled = false;
  });
  clearBtn.addEventListener('click', clearSheet);

  refreshButtons();
})();
