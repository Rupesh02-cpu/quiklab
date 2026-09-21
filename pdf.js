/* QuikLab — client-side PDF toolkit.
   Merge / split / compress / rotate / watermark / image<->PDF conversion.
   Built on pdf-lib (writing/editing) and pdf.js (rendering pages to canvas
   for thumbnails and PDF->image export). No PDF content ever leaves the tab. */

(() => {
  const { PDFDocument, degrees, rgb, StandardFonts } = window.PDFLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  function track(eventName, params) {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, params || {});
  }

  // ---------- theme toggle (shared behavior with the image compressor) ----------
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
  }
  themeToggle.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(currentTheme()) + 1) % order.length];
    applyTheme(next);
  });
  applyTheme(currentTheme());

  // ---------- toast ----------
  const toastStack = document.getElementById('toastStack');
  function showToast(message, { duration = 4000 } = {}) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-msg"></span>`;
    toast.querySelector('.toast-msg').textContent = message;
    toastStack.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 200); }, duration);
  }

  // ---------- helpers ----------
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  function fileExt(name) { return (name.split('.').pop() || '').toLowerCase(); }
  function stripExt(name) { return name.replace(/\.[^.]+$/, ''); }
  async function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---------- tool registry ----------
  const TOOLS = {
    merge: {
      title: 'Merge PDFs',
      desc: 'Add two or more PDFs, drag to reorder, then merge into one file.',
      accept: 'application/pdf',
      multiple: true,
      dropLabel: 'Drop PDF files here',
      showFileList: true,
      runLabel: 'Merge PDFs',
      minFiles: 2,
    },
    split: {
      title: 'Split & extract',
      desc: 'Upload one PDF, select the pages you want, then pull them into a new PDF.',
      accept: 'application/pdf',
      multiple: false,
      dropLabel: 'Drop a PDF here',
      showPageGrid: true,
      runLabel: 'Extract selected pages',
    },
    compress: {
      title: 'Compress PDF',
      desc: 'Re-encodes embedded images at a lower quality to shrink file size.',
      accept: 'application/pdf',
      multiple: false,
      dropLabel: 'Drop a PDF here',
      showFileList: true,
      showCompressForm: true,
      runLabel: 'Compress PDF',
    },
    rotate: {
      title: 'Rotate pages',
      desc: 'Click a page to rotate it 90°, or rotate every page at once.',
      accept: 'application/pdf',
      multiple: false,
      dropLabel: 'Drop a PDF here',
      showPageGrid: true,
      runLabel: 'Save rotated PDF',
    },
    watermark: {
      title: 'Add watermark',
      desc: 'Stamp text across every page of your PDF.',
      accept: 'application/pdf',
      multiple: false,
      dropLabel: 'Drop a PDF here',
      showFileList: true,
      showWatermarkForm: true,
      runLabel: 'Add watermark',
    },
    img2pdf: {
      title: 'Image → PDF',
      desc: 'Upload JPG, PNG, or WebP images — each becomes its own page, in the order added.',
      accept: 'image/png,image/jpeg,image/webp',
      multiple: true,
      dropLabel: 'Drop images here',
      showFileList: true,
      runLabel: 'Create PDF',
    },
    pdf2img: {
      title: 'PDF → image',
      desc: 'Upload a PDF and export every page as a PNG image.',
      accept: 'application/pdf',
      multiple: false,
      dropLabel: 'Drop a PDF here',
      showFileList: true,
      runLabel: 'Export pages as PNG',
    },
  };

  // ---------- state ----------
  let activeTool = null;
  let files = [];          // [{file, id}]
  let pdfDoc = null;        // loaded pdf-lib PDFDocument (single-PDF tools)
  let pdfBytesOrig = null;  // ArrayBuffer of the loaded PDF, for pdf.js rendering
  let pageMeta = [];        // [{index, rotationAdd, selected}]
  let nextId = 1;
  let resultBlobs = [];     // [{blob, filename}] — supports multi-file zip results

  // ---------- DOM ----------
  const toolGrid = document.getElementById('toolGrid');
  const workspace = document.getElementById('workspace');
  const workspaceTitle = document.getElementById('workspaceTitle');
  const workspaceDesc = document.getElementById('workspaceDesc');
  const backToTools = document.getElementById('backToTools');

  const pdfDrop = document.getElementById('pdfDrop');
  const pdfFileInput = document.getElementById('pdfFileInput');
  const pdfBrowseBtn = document.getElementById('pdfBrowseBtn');
  const pdfDropLabel = document.getElementById('pdfDropLabel');
  const pdfFileList = document.getElementById('pdfFileList');
  const pageGrid = document.getElementById('pageGrid');

  const watermarkForm = document.getElementById('watermarkForm');
  const wmText = document.getElementById('wmText');
  const wmPosition = document.getElementById('wmPosition');
  const wmOpacity = document.getElementById('wmOpacity');
  const wmOpacityVal = document.getElementById('wmOpacityVal');
  const wmSize = document.getElementById('wmSize');
  const wmSizeVal = document.getElementById('wmSizeVal');
  const wmColor = document.getElementById('wmColor');

  const compressForm = document.getElementById('compressForm');
  const compressQuality = document.getElementById('compressQuality');
  const compressQualityVal = document.getElementById('compressQualityVal');

  const pdfToolbar = document.getElementById('pdfToolbar');
  const pdfHint = document.getElementById('pdfHint');
  const pdfClearBtn = document.getElementById('pdfClearBtn');
  const pdfRunBtn = document.getElementById('pdfRunBtn');
  const pdfProgress = document.getElementById('pdfProgress');
  const pdfResult = document.getElementById('pdfResult');
  const pdfResultTitle = document.getElementById('pdfResultTitle');
  const pdfResultDetail = document.getElementById('pdfResultDetail');
  const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
  const pdfDownloadAllBtn = document.getElementById('pdfDownloadAllBtn');

  wmOpacity.addEventListener('input', () => { wmOpacityVal.textContent = wmOpacity.value; });
  wmSize.addEventListener('input', () => { wmSizeVal.textContent = wmSize.value; });
  compressQuality.addEventListener('input', () => { compressQualityVal.textContent = compressQuality.value; });

  // ---------- tool selection ----------
  toolGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.tool-card');
    if (!card) return;
    openTool(card.dataset.tool);
  });
  backToTools.addEventListener('click', closeTool);

  function openTool(name) {
    activeTool = name;
    const t = TOOLS[name];
    resetWorkspaceState();

    document.querySelectorAll('.tool-card').forEach(c => {
      c.classList.toggle('is-active', c.dataset.tool === name);
      c.setAttribute('aria-selected', c.dataset.tool === name ? 'true' : 'false');
    });

    workspaceTitle.textContent = t.title;
    workspaceDesc.textContent = t.desc;
    pdfDropLabel.textContent = t.dropLabel;
    pdfFileInput.accept = t.accept;
    pdfFileInput.multiple = !!t.multiple;

    pdfFileList.hidden = !t.showFileList;
    pageGrid.hidden = !t.showPageGrid;
    watermarkForm.hidden = !t.showWatermarkForm;
    compressForm.hidden = !t.showCompressForm;

    pdfRunBtn.textContent = t.runLabel;
    workspace.hidden = false;
    workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    track('pdf_tool_open', { tool: name });
  }

  function closeTool() {
    workspace.hidden = true;
    activeTool = null;
    document.querySelectorAll('.tool-card').forEach(c => {
      c.classList.remove('is-active');
      c.setAttribute('aria-selected', 'false');
    });
  }

  function resetWorkspaceState() {
    files = [];
    pdfDoc = null;
    pdfBytesOrig = null;
    pageMeta = [];
    resultBlobs = [];
    pdfFileList.innerHTML = '';
    pageGrid.innerHTML = '';
    pdfToolbar.hidden = true;
    pdfProgress.hidden = true;
    pdfProgress.querySelector('span').style.width = '0%';
    pdfResult.hidden = true;
    pdfDownloadAllBtn.hidden = true;
    pdfRunBtn.disabled = true;
    pdfFileInput.value = '';
  }

  // ---------- ingest ----------
  pdfBrowseBtn.addEventListener('click', () => pdfFileInput.click());
  pdfFileInput.addEventListener('change', () => ingestFiles(pdfFileInput.files));
  pdfDrop.addEventListener('dragenter', (e) => { e.preventDefault(); pdfDrop.classList.add('drag'); });
  pdfDrop.addEventListener('dragover', (e) => { e.preventDefault(); pdfDrop.classList.add('drag'); });
  pdfDrop.addEventListener('dragleave', () => pdfDrop.classList.remove('drag'));
  pdfDrop.addEventListener('drop', (e) => {
    e.preventDefault(); pdfDrop.classList.remove('drag');
    ingestFiles(e.dataTransfer.files);
  });

  async function ingestFiles(fileList) {
    const t = TOOLS[activeTool];
    const accepted = Array.from(fileList).filter(f => {
      if (t.accept.startsWith('application/pdf')) return fileExt(f.name) === 'pdf' || f.type === 'application/pdf';
      return f.type.startsWith('image/');
    });
    if (!accepted.length) { showToast('No supported files in that selection.'); return; }

    if (!t.multiple) {
      files = [{ file: accepted[0], id: nextId++ }];
    } else {
      accepted.forEach(f => files.push({ file: f, id: nextId++ }));
    }

    renderFileList();

    if (t.showPageGrid) {
      await loadPdfForPageGrid(files[0].file);
    }

    updateRunEnabled();
    pdfToolbar.hidden = false;
    pdfResult.hidden = true;
  }

  function renderFileList() {
    pdfFileList.innerHTML = '';
    files.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'pdf-file-row';
      row.draggable = TOOLS[activeTool].multiple;
      row.dataset.id = entry.id;
      row.innerHTML = `
        <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-pdf"/></svg>
        <span class="pdf-file-name"></span>
        <span class="pdf-file-meta mono"></span>
        <button type="button" class="pdf-file-remove" aria-label="Remove file">
          <svg class="icon icon-sm" aria-hidden="true"><use href="#icon-trash"/></svg>
        </button>
      `;
      row.querySelector('.pdf-file-name').textContent = entry.file.name;
      row.querySelector('.pdf-file-meta').textContent = fmtSize(entry.file.size);
      row.querySelector('.pdf-file-remove').addEventListener('click', () => {
        files = files.filter(f => f.id !== entry.id);
        renderFileList();
        updateRunEnabled();
      });
      pdfFileList.appendChild(row);
    });
    wireDragReorder();
  }

  function wireDragReorder() {
    let dragId = null;
    pdfFileList.querySelectorAll('.pdf-file-row[draggable="true"]').forEach(row => {
      row.addEventListener('dragstart', () => { dragId = row.dataset.id; row.classList.add('is-dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragId || dragId === row.dataset.id) return;
        const fromIdx = files.findIndex(f => String(f.id) === dragId);
        const toIdx = files.findIndex(f => String(f.id) === row.dataset.id);
        const [moved] = files.splice(fromIdx, 1);
        files.splice(toIdx, 0, moved);
        renderFileList();
      });
    });
  }

  function updateRunEnabled() {
    const t = TOOLS[activeTool];
    let ok = files.length > 0;
    if (t.minFiles) ok = files.length >= t.minFiles;
    if (t.showPageGrid) {
      ok = activeTool === 'rotate' ? files.length > 0 : pageMeta.some(p => p.selected);
    }
    pdfRunBtn.disabled = !ok;
    pdfHint.textContent = t.minFiles && files.length < t.minFiles
      ? `Add at least ${t.minFiles} files.`
      : (t.showPageGrid ? `${pageMeta.filter(p => p.selected).length} of ${pageMeta.length} pages selected` : '');
  }

  // ---------- page grid (split / rotate) ----------
  async function loadPdfForPageGrid(file) {
    pageGrid.innerHTML = '<p class="pdf-hint">Loading pages…</p>';
    const buf = await readAsArrayBuffer(file);
    pdfBytesOrig = buf;
    pdfDoc = await PDFDocument.load(buf.slice(0));

    const loadingTask = pdfjsLib.getDocument({ data: buf.slice(0) });
    const doc = await loadingTask.promise;
    const count = doc.numPages;
    pageMeta = Array.from({ length: count }, (_, i) => ({ index: i, rotationAdd: 0, selected: activeTool === 'rotate' }));

    pageGrid.innerHTML = '';
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const thumb = document.createElement('div');
      thumb.className = 'page-thumb';
      thumb.dataset.index = i - 1;
      if (activeTool === 'rotate') thumb.classList.add('is-selected');
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      thumb.appendChild(img);

      const check = document.createElement('span');
      check.className = 'page-thumb-check';
      check.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#icon-check"/></svg>';
      thumb.appendChild(check);

      const num = document.createElement('span');
      num.className = 'page-thumb-num';
      num.textContent = `Page ${i}`;
      thumb.appendChild(num);

      if (activeTool === 'rotate') {
        const rotateBtn = document.createElement('button');
        rotateBtn.type = 'button';
        rotateBtn.className = 'page-thumb-rotate';
        rotateBtn.setAttribute('aria-label', `Rotate page ${i}`);
        rotateBtn.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#icon-rotate"/></svg>';
        rotateBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const meta = pageMeta[i - 1];
          meta.rotationAdd = (meta.rotationAdd + 90) % 360;
          img.classList.remove('rot-90', 'rot-180', 'rot-270');
          if (meta.rotationAdd === 90) img.classList.add('rot-90');
          if (meta.rotationAdd === 180) img.classList.add('rot-180');
          if (meta.rotationAdd === 270) img.classList.add('rot-270');
        });
        thumb.appendChild(rotateBtn);
      } else {
        thumb.addEventListener('click', () => {
          const meta = pageMeta[i - 1];
          meta.selected = !meta.selected;
          thumb.classList.toggle('is-selected', meta.selected);
          updateRunEnabled();
        });
      }

      pageGrid.appendChild(thumb);
    }
    updateRunEnabled();
  }

  // ---------- run ----------
  pdfRunBtn.addEventListener('click', runTool);
  pdfClearBtn.addEventListener('click', () => { resetWorkspaceState(); });

  function setProgress(pct) {
    pdfProgress.hidden = false;
    pdfProgress.querySelector('span').style.width = pct + '%';
  }
  function showResult(title, detail, blob, filename, extraZipBlobs) {
    pdfProgress.hidden = true;
    pdfResult.hidden = false;
    pdfResultTitle.textContent = title;
    pdfResultDetail.textContent = detail;
    pdfDownloadBtn.onclick = () => downloadBlob(blob, filename);
    if (extraZipBlobs && extraZipBlobs.length > 1) {
      pdfDownloadAllBtn.hidden = false;
      pdfDownloadAllBtn.onclick = async () => {
        const zip = new JSZip();
        extraZipBlobs.forEach(({ blob, filename }) => zip.file(filename, blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'quiklab-pdf-export.zip');
      };
    } else {
      pdfDownloadAllBtn.hidden = true;
    }
  }

  async function runTool() {
    pdfRunBtn.disabled = true;
    pdfResult.hidden = true;
    setProgress(10);
    try {
      switch (activeTool) {
        case 'merge': await runMerge(); break;
        case 'split': await runSplit(); break;
        case 'compress': await runCompress(); break;
        case 'rotate': await runRotate(); break;
        case 'watermark': await runWatermark(); break;
        case 'img2pdf': await runImg2Pdf(); break;
        case 'pdf2img': await runPdf2Img(); break;
      }
      track('pdf_tool_run', { tool: activeTool });
    } catch (err) {
      console.error(err);
      pdfProgress.hidden = true;
      showToast('Something went wrong processing that file. It may be encrypted or corrupted.');
    } finally {
      pdfRunBtn.disabled = false;
    }
  }

  // ---------- merge ----------
  async function runMerge() {
    const out = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      const buf = await readAsArrayBuffer(files[i].file);
      const src = await PDFDocument.load(buf);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
      setProgress(10 + Math.round(((i + 1) / files.length) * 80));
    }
    const bytes = await out.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    showResult('Merged', `${files.length} files → 1 PDF, ${fmtSize(blob.size)}`, blob, 'quiklab-merged.pdf');
  }

  // ---------- split / extract ----------
  async function runSplit() {
    const selected = pageMeta.filter(p => p.selected).map(p => p.index);
    if (!selected.length) { showToast('Select at least one page.'); pdfProgress.hidden = true; return; }
    const srcBuf = pdfBytesOrig;
    const src = await PDFDocument.load(srcBuf.slice(0));
    setProgress(40);

    // One combined PDF of the selected pages
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, selected);
    pages.forEach(p => out.addPage(p));
    const bytes = await out.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    setProgress(90);

    const baseName = stripExt(files[0].file.name);
    showResult(
      'Extracted',
      `${selected.length} of ${pageMeta.length} pages → 1 PDF, ${fmtSize(blob.size)}`,
      blob,
      `${baseName}-extracted.pdf`
    );
  }

  // ---------- compress ----------
  async function runCompress() {
    const file = files[0].file;
    const buf = await readAsArrayBuffer(file);
    const originalSize = file.size;
    setProgress(25);

    // Re-render each page through pdf.js at a modest scale and re-encode as
    // JPEG at the chosen quality, rebuilding a new PDF from those images.
    // This trades perfect text fidelity on image-only paths for real size
    // reduction; it's the same "flatten and re-encode" approach a
    // browser-only compressor can realistically do without a PDF filter
    // engine, and it's most effective on image-heavy / scanned PDFs.
    const quality = Number(compressQuality.value) / 100;
    const loadingTask = pdfjsLib.getDocument({ data: buf.slice(0) });
    const doc = await loadingTask.promise;
    const out = await PDFDocument.create();

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      const jpegBytes = await (await fetch(jpegDataUrl)).arrayBuffer();
      const embedded = await out.embedJpg(jpegBytes);
      const pdfPage = out.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(embedded, { x: 0, y: 0, width: viewport.width, height: viewport.height });

      setProgress(25 + Math.round((i / doc.numPages) * 65));
    }

    const bytes = await out.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });

    if (blob.size >= originalSize) {
      showResult('No gain — original kept', `Compression wouldn't shrink this file (${fmtSize(originalSize)}), so the original was kept.`, file, file.name);
    } else {
      const pct = Math.round((1 - blob.size / originalSize) * 100);
      showResult('Compressed', `${fmtSize(originalSize)} → ${fmtSize(blob.size)} (−${pct}%)`, blob, `${stripExt(file.name)}-compressed.pdf`);
    }
  }

  // ---------- rotate ----------
  async function runRotate() {
    const src = await PDFDocument.load(pdfBytesOrig.slice(0));
    const pages = src.getPages();
    pageMeta.forEach((meta, i) => {
      if (meta.rotationAdd) {
        const page = pages[i];
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + meta.rotationAdd) % 360));
      }
    });
    setProgress(70);
    const bytes = await src.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const rotatedCount = pageMeta.filter(m => m.rotationAdd).length;
    showResult('Rotated', `${rotatedCount} page(s) rotated, ${fmtSize(blob.size)}`, blob, `${stripExt(files[0].file.name)}-rotated.pdf`);
  }

  // ---------- watermark ----------
  async function runWatermark() {
    const file = files[0].file;
    const buf = await readAsArrayBuffer(file);
    const doc = await PDFDocument.load(buf);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = wmText.value.trim() || 'CONFIDENTIAL';
    const opacity = Number(wmOpacity.value) / 100;
    const size = Number(wmSize.value);
    const colorMap = { gray: rgb(0.5, 0.5, 0.5), red: rgb(0.78, 0.2, 0.12), black: rgb(0.1, 0.1, 0.1) };
    const color = colorMap[wmColor.value] || colorMap.gray;
    const position = wmPosition.value;

    const pages = doc.getPages();
    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, size);

      if (position === 'center') {
        page.drawText(text, {
          x: width / 2 - textWidth / 2, y: height / 2, size, font, color, opacity,
          rotate: degrees(45),
        });
      } else if (position === 'bottom') {
        page.drawText(text, {
          x: width / 2 - textWidth / 2, y: Math.max(24, height * 0.06), size, font, color, opacity,
        });
      } else if (position === 'tile') {
        const stepX = textWidth + 80;
        const stepY = size + 80;
        for (let y = -height; y < height * 2; y += stepY) {
          for (let x = -width; x < width * 2; x += stepX) {
            page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(45) });
          }
        }
      }
      setProgress(20 + Math.round(((i + 1) / pages.length) * 70));
    });

    const bytes = await doc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    showResult('Watermarked', `${pages.length} page(s), ${fmtSize(blob.size)}`, blob, `${stripExt(file.name)}-watermarked.pdf`);
  }

  // ---------- image -> pdf ----------
  async function runImg2Pdf() {
    const out = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      const file = files[i].file;
      const buf = await readAsArrayBuffer(file);
      let img;
      if (file.type === 'image/png') img = await out.embedPng(buf);
      else {
        // WebP isn't embeddable by pdf-lib directly — re-encode any
        // non-JPEG/PNG source (including WebP) to JPEG via canvas first.
        if (file.type === 'image/jpeg') {
          img = await out.embedJpg(buf);
        } else {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
          const jpegBuf = await (await fetch(canvas.toDataURL('image/jpeg', 0.92))).arrayBuffer();
          img = await out.embedJpg(jpegBuf);
        }
      }
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      setProgress(10 + Math.round(((i + 1) / files.length) * 80));
    }
    const bytes = await out.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    showResult('PDF created', `${files.length} image(s) → 1 PDF, ${fmtSize(blob.size)}`, blob, 'quiklab-images.pdf');
  }

  // ---------- pdf -> image ----------
  async function runPdf2Img() {
    const file = files[0].file;
    const buf = await readAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    const doc = await loadingTask.promise;
    const baseName = stripExt(file.name);
    const pngs = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      pngs.push({ blob, filename: `${baseName}-page${String(i).padStart(2, '0')}.png` });
      setProgress(10 + Math.round((i / doc.numPages) * 80));
    }

    showResult('Exported', `${pngs.length} page(s) as PNG`, pngs[0].blob, pngs[0].filename, pngs);
  }
})();
