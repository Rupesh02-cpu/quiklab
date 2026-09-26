import Link from "next/link";

export function PdfAboutSection() {
  return (
    <section className="about">
      <div className="about-inner">
        <h2>About the PDF toolkit</h2>
        <p>
          QuikLab&apos;s PDF toolkit is a set of common PDF operations: merge, split, compress, rotate, watermark,
          and convert to/from images, that all run locally in your browser. There&apos;s no upload step, no
          account, and no server involved.
        </p>

        <details className="faq-item">
          <summary>
            <h3>Is my PDF uploaded anywhere?</h3>
          </summary>
          <p>
            No. Every operation runs in your browser using JavaScript (via the pdf-lib and pdf.js libraries). Your PDF
            and its contents never leave your device.
          </p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>How does QuikLab compress a PDF?</h3>
          </summary>
          <p>
            It re-encodes embedded images inside the PDF at a lower quality and removes unused objects, which shrinks
            image-heavy PDFs substantially. Text-only PDFs are already compact and may not shrink much further.
          </p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>Can I merge PDFs in a specific order?</h3>
          </summary>
          <p>Yes. Add your files and drag them into the order you want before merging, and the output follows that order.</p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>Can I convert images to a PDF, or a PDF to images?</h3>
          </summary>
          <p>
            Yes, both directions. Image to PDF places each JPG, PNG, or WebP you upload on its own page. PDF to image
            renders each page of a PDF as a downloadable PNG.
          </p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>Looking for the image compressor?</h3>
          </summary>
          <p>
            <Link href="/">QuikLab&apos;s image compressor</Link> resizes and compresses JPG, PNG, WebP, SVG, and GIF
            files the same way, entirely in your browser.
          </p>

        </details>
      </div>
    </section>
  );
}
