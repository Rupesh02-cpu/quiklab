// Synthetic browser checks: really compress an image and merge two PDFs.
// Works with both the old wizard UI (/pdf shows the tool grid first) and the
// unified upload UI (drop first, then the tool grid). Fixtures are generated
// at runtime; no user data is ever involved.
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";

const STEP_TIMEOUT = 30_000;
export const SYNTHETIC_SLOW_MS = 45_000;

async function makePdf(label) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 300]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(`QuikLab status check: ${label}`, { x: 30, y: 150, size: 16, font });
  return Buffer.from(await doc.save());
}

// A noisy 480x320 PNG drawn on a canvas so compression has real work to do.
async function makePng(page) {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 320;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const p = i / 4;
      img.data[i] = (p % 480) / 2;
      img.data[i + 1] = Math.floor(p / 480) / 1.3;
      img.data[i + 2] = (p * 7) % 256;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

// Runs steps in order; on failure reports which step broke.
async function runSteps(name, steps) {
  const start = Date.now();
  let current = "start";
  try {
    for (const [label, fn] of steps) {
      current = label;
      await fn();
    }
    const ms = Date.now() - start;
    return { name, ok: true, level: "ok", ms, slowMs: SYNTHETIC_SLOW_MS, detail: `Passed in ${ms} ms` };
  } catch (err) {
    const msg = String(err?.message || err).split("\n")[0].slice(0, 200);
    return { name, ok: false, level: "fail", ms: Date.now() - start, slowMs: SYNTHETIC_SLOW_MS, detail: `Failed at "${current}": ${msg}` };
  }
}

function fileInput(page) {
  return page.locator('input[type="file"]').first();
}

function toolGrid(page) {
  return page.getByRole("tablist", { name: "PDF tools" });
}

async function imageCheck(browser, base) {
  const page = await browser.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT);
  let png;
  const result = await runSteps("image-synthetic", [
    ["open /", () => page.goto(`${base}/`, { waitUntil: "load", timeout: STEP_TIMEOUT })],
    ["make PNG fixture", async () => { png = await makePng(page); }],
    ["upload PNG", async () => {
      await fileInput(page).waitFor({ state: "attached" });
      await fileInput(page).setInputFiles({ name: "status-check.png", mimeType: "image/png", buffer: png });
    }],
    ["click Compress", async () => {
      const btn = page.getByRole("button", { name: /Compress images/i });
      await btn.waitFor({ state: "visible" });
      await btn.click();
    }],
    ["wait for Download", () => page.getByRole("button", { name: /^Download$/ }).first().waitFor({ state: "visible" })],
  ]);
  await page.close();
  return result;
}

async function pdfCheck(browser, base) {
  const page = await browser.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT);
  const files = [
    { name: "status-a.pdf", mimeType: "application/pdf", buffer: await makePdf("A") },
    { name: "status-b.pdf", mimeType: "application/pdf", buffer: await makePdf("B") },
  ];
  const pickMerge = () => toolGrid(page).getByRole("tab", { name: /Merge PDFs/i }).click();
  const upload = async () => {
    await fileInput(page).waitFor({ state: "attached" });
    await fileInput(page).setInputFiles(files);
  };
  const result = await runSteps("pdf-synthetic", [
    ["open /pdf", () => page.goto(`${base}/pdf`, { waitUntil: "load", timeout: STEP_TIMEOUT })],
    ["detect UI", async () => {
      // Old UI: tool grid first. New UI: drop zone first, then grid.
      const grid = toolGrid(page);
      await Promise.race([grid.waitFor({ state: "visible" }), fileInput(page).waitFor({ state: "attached" })]);
    }],
    ["upload PDFs and pick Merge", async () => {
      if (await toolGrid(page).isVisible()) {
        await pickMerge();
        await upload();
      } else {
        await upload();
        await toolGrid(page).waitFor({ state: "visible" });
        await pickMerge();
      }
    }],
    ["click Merge", async () => {
      const run = page.getByRole("button", { name: /^Merge PDFs$/ });
      await run.waitFor({ state: "visible" });
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Merge PDFs");
        return b && !b.disabled;
      }, null, { timeout: STEP_TIMEOUT });
      await run.click();
    }],
    ["wait for Download", () => page.getByRole("button", { name: /^Download$/ }).first().waitFor({ state: "visible" })],
  ]);
  await page.close();
  return result;
}

// Returns { image: [check], pdf: [check] }.
export async function runSyntheticChecks(base) {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    // Browser could not start: this is a monitor problem, not a site outage.
    const detail = `Browser failed to launch: ${String(err?.message || err).split("\n")[0]}`;
    return { error: detail };
  }
  try {
    const image = await imageCheck(browser, base);
    const pdf = await pdfCheck(browser, base);
    return { image: [image], pdf: [pdf] };
  } finally {
    await browser.close();
  }
}
