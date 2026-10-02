export function AboutSection() {
  return (
    <section className="about">
      <div className="about-inner">
        <h2>About the file converter</h2>
        <p>
          QuikLab&apos;s converter handles HEIC photos, Word documents, CSV, JSON, and Markdown files entirely in
          your browser. There&apos;s no upload step, no account, and no server involved: your browser does the
          conversion itself.
        </p>

        <details className="faq-item">
          <summary>
            <h3>Why convert a HEIC photo to JPG or PNG?</h3>
          </summary>
          <p>
            HEIC is the default photo format on recent iPhones, but many apps, sites, and older devices don&apos;t
            open it. Converting to JPG or PNG makes the photo viewable and shareable everywhere, with no visible
            quality loss for most uses.
          </p>
        </details>

        <details className="faq-item">
          <summary>
            <h3>What can I convert a Word document, CSV, JSON, or Markdown file to?</h3>
          </summary>
          <p>
            Each format has its own set of sensible targets. For example, a <code>.docx</code> file can come out as
            plain text or Markdown, and CSV, JSON, and Markdown can convert between each other where the structure
            maps cleanly. QuikLab only offers a target format when the conversion is lossless or clearly expected.
          </p>
        </details>

        <details className="faq-item">
          <summary>
            <h3>What does &quot;paste a link instead&quot; do?</h3>
          </summary>
          <p>
            It lets your browser fetch a file directly from a URL you paste, instead of you downloading it first.
            No server of ours is involved: your browser requests it straight from the link, which only works when
            the remote host allows cross-origin access. Most ordinary file-hosting pages don&apos;t, and you&apos;ll
            get a clear message pointing you back to a direct upload.
          </p>
        </details>

        <details className="faq-item">
          <summary>
            <h3>Is my file uploaded anywhere?</h3>
          </summary>
          <p>
            No, when you choose a file directly, it&apos;s read and converted locally in your browser and never
            leaves your device.
          </p>
        </details>
      </div>
    </section>
  );
}
