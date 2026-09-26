export function AboutSection() {
  return (
    <section className="about">
      <div className="about-inner">
        <h2>About QuikLab</h2>
        <p>
          QuikLab is a free image compressor that resizes and compresses JPG, PNG, WebP, SVG, and GIF files directly
          in your browser. There&apos;s no upload step, no account, and no server involved: the Canvas API does the
          work on your own device, so your images never leave it.
        </p>

        <details className="faq-item">
          <summary>
            <h3>How does QuikLab compress images?</h3>
          </summary>
          <p>
            For JPG and WebP, QuikLab re-encodes the image at a lower quality setting using the browser&apos;s
            built-in Canvas API, which typically shrinks photos by 20 to 60 percent with little visible difference.
            You can either pick a quality level directly, or tell QuikLab a target file size (like &quot;under
            100KB&quot;) and it searches for the highest quality that still fits. PNG files are lossless by nature, so
            QuikLab only resizes them unless a smaller result is actually possible. SVG files are minified by
            stripping unnecessary comments and editor metadata, since they&apos;re vector markup rather than pixels.
          </p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>Is it safe to compress images with QuikLab?</h3>
          </summary>
          <p>
            Yes. QuikLab never uploads your images anywhere. All processing happens locally in your browser using
            JavaScript and the Canvas API, so your files stay on your device the entire time. This also means QuikLab
            works without an internet connection once the page has loaded.
          </p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>Does compressing an image reduce its quality?</h3>
          </summary>
          <p>
            JPG and WebP compression is lossy, so a lower quality setting can introduce visible artifacts if pushed
            too far. QuikLab defaults to a quality level that keeps files small while staying visually close to the
            original, and it never returns a &quot;compressed&quot; file that&apos;s larger than what you uploaded.
          </p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>What file types does QuikLab support?</h3>
          </summary>
          <p>
            QuikLab accepts JPG, PNG, WebP, SVG, and GIF files, and can convert between JPG, PNG, and WebP on output.
            Animated GIFs stay animated and keep their own format.
          </p>

        </details>

        <details className="faq-item">
          <summary>
            <h3>Does QuikLab remove EXIF and GPS data from photos?</h3>
          </summary>
          <p>
            Yes, when a JPEG is actually re-encoded, which is the normal case. Re-encoding through the Canvas API
            produces a new file with no metadata, including camera details and GPS location. The one exception is
            when compressing wouldn&apos;t shrink the file at all, in which case QuikLab keeps the original bytes
            untouched rather than handing back something bigger, and in that specific case the original metadata
            stays too. This is shown per-file as &quot;no gain, original kept.&quot;
          </p>

        </details>
      </div>
    </section>
  );
}
