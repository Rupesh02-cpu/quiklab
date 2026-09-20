/* QuikLab — client-side image resize & compress.
   Everything below runs in the browser via the Canvas API.
   No image ever leaves the tab. */

(() => {
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

  const processBtn = document.getElementById('processBtn');
  const countBadge = document.getElementById('countBadge');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const clearBtn    = document.getElementById('clearBtn');

  const totalsEl   = document.getElementById('totals');
  const totalBeforeEl = document.getElementById('totalBefore');
  const totalAfterEl  = document.getElementById('totalAfter');
  const totalSaveChip = document.getElementById('totalSaveChip');

  /** @type {{id:number, file:File, originalUrl:string, originalSize:number,
   *          resultBlob:Blob|null, resultSize:number, resultExt:string, el:HTMLElement}[]} */
  let items = [];
  let nextId = 1;

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
  }[mime] || 'jpg');

  const targetMimeFor = (file) => {
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
    totalSaveChip.textContent = `${pct >= 0 ? '−' : '+'}${Math.abs(pct)}%`;
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
        <div class="frame-status" data-role="status">queued</div>
      </div>
      <div class="frame-body">
        <div class="frame-name clarity-mask" data-role="fname"></div>
        <div class="frame-sizes">
          <span class="mono">${fmtBytes(item.originalSize)}</span>
          <span class="arrow">→</span>
          <span class="mono after" data-role="afterSize">—</span>
        </div>
        <div class="frame-bar"><span data-role="bar" style="width:0%"></span></div>
        <div class="frame-actions">
          <span class="frame-save" data-role="saveTag"></span>
          <button class="frame-dl" data-role="dl" disabled>Download</button>
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
    dlBtn.addEventListener('click', async () => {
      const original = dlBtn.textContent;
      dlBtn.textContent = 'Saving…';
      dlBtn.disabled = true;
      await downloadOne(item);
      dlBtn.textContent = original;
      dlBtn.disabled = false;
    });
    item.el = frame;
    framesEl.appendChild(frame);
  }

  function setFrameStatus(item, text, show) {
    const statusEl = item.el.querySelector('[data-role="status"]');
    statusEl.textContent = text;
    statusEl.style.display = show ? 'flex' : 'none';
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
      saveTagEl.textContent = 'no gain — original kept';
      saveTagEl.title = 'Re-encoding this file would have made it larger, so the original bytes were kept instead.';
    } else {
      saveTagEl.textContent = pct >= 0 ? `−${pct}% smaller` : `+${Math.abs(pct)}% larger`;
      saveTagEl.title = '';
    }
    dlBtn.disabled = false;
  }

  // ---------- ingest files ----------
  function addFiles(fileList) {
    const files = Array.from(fileList).filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (!files.length) return;
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

  async function processItem(item) {
    setFrameStatus(item, 'developing…', true);
    try {
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
      const quality = Math.min(1, Math.max(0.1, Number(qualityEl.value) / 100));
      const wasResized = (width !== img.naturalWidth || height !== img.naturalHeight);
      const wasReformatted = (mime !== item.file.type);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));

      // Canvas re-encoding a lossless format (PNG) ignores the quality
      // slider entirely and can't match a well-optimized original encoder's
      // compression — confirmed against real screenshots/exports in testing,
      // where "compression" made the file up to ~30% BIGGER. If nothing was
      // actually asked to change (no resize, no forced format) and the
      // result isn't actually smaller, that's not a compression result
      // worth shipping — fall back to the original bytes instead of
      // silently handing back a larger file.
      const noGain = blob.size >= item.originalSize;
      if (noGain && !wasResized && !wasReformatted) {
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
      setFrameStatus(item, '', false);
      setFrameResult(item);
    } catch (err) {
      console.error(err);
      setFrameStatus(item, 'failed', true);
    }
  }

  async function processAll() {
    processBtn.disabled = true;
    processBtn.textContent = 'Developing…';
    for (const item of items) {
      await processItem(item);
    }
    processBtn.textContent = 'Develop';
    processBtn.disabled = false;
    refreshButtons();
    updateTotals();
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
    await saveFile(outputName(item), item.resultBlob);
  }

  async function downloadAll() {
    const done = items.filter(i => i.resultBlob);
    if (!done.length) return;
    const zip = new JSZip();
    done.forEach(item => zip.file(outputName(item), item.resultBlob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    await saveFile('quiklab-compressed.zip', zipBlob);
  }

  function clearSheet() {
    items.forEach(i => URL.revokeObjectURL(i.originalUrl));
    items = [];
    framesEl.querySelectorAll('.frame').forEach(f => f.remove());
    refreshButtons();
    updateTotals();
  }

  // ---------- events ----------
  qualityEl.addEventListener('input', () => { qualityVal.textContent = qualityEl.value; });

  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => addFiles(e.target.files));

  ['dragenter', 'dragover'].forEach(evt =>
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag'); })
  );
  dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));

  processBtn.addEventListener('click', processAll);
  downloadAllBtn.addEventListener('click', async () => {
    const original = downloadAllBtn.textContent;
    downloadAllBtn.textContent = 'Zipping…';
    downloadAllBtn.disabled = true;
    await downloadAll();
    downloadAllBtn.textContent = original;
    downloadAllBtn.disabled = false;
  });
  clearBtn.addEventListener('click', clearSheet);

  refreshButtons();
})();
