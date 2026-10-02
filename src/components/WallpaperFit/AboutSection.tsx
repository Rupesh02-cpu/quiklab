export function AboutSection() {
  return (
    <section className="about">
      <div className="about-inner">
        <h2>About wallpaper fit</h2>
        <p>
          Wallpaper fit crops a photo to an exact phone or device resolution, so the result fills the screen
          without your OS wallpaper picker cropping it again (and often off-center). Everything runs in your
          browser with the Canvas API: there&apos;s no upload, no account, and no server involved.
        </p>

        <details className="faq-item">
          <summary>
            <h3>How do I pick the right size for my phone?</h3>
          </summary>
          <p>
            Choose your device from the preset list (common iPhone and Android resolutions), pick a common aspect
            ratio, or enter a custom width and height. The crop preview then matches your screen&apos;s exact pixel
            dimensions.
          </p>
        </details>

        <details className="faq-item">
          <summary>
            <h3>Can I reposition the photo inside the crop?</h3>
          </summary>
          <p>
            Yes. Drag to pan and use the wheel or a pinch gesture to zoom, and the live preview updates as you
            adjust it. A safe-area guide can be toggled on to show where lock-screen clock and widgets usually sit.
          </p>
        </details>

        <details className="faq-item">
          <summary>
            <h3>What happens if my photo is smaller than the target size?</h3>
          </summary>
          <p>
            QuikLab warns you and upscales it to fit. Quality holds up better starting from a larger original, so
            for best results use the highest-resolution photo you have.
          </p>
        </details>

        <details className="faq-item">
          <summary>
            <h3>Is my photo uploaded anywhere?</h3>
          </summary>
          <p>
            No. Cropping and exporting both happen locally using the Canvas API, so the photo never leaves your
            device. Re-encoding the result also strips EXIF and GPS metadata, the same as QuikLab&apos;s image
            compressor.
          </p>
        </details>
      </div>
    </section>
  );
}
