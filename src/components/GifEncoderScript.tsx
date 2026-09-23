import Script from "next/script";

// gif.js has no npm/ESM build we control the shape of — loaded as a
// classic global script (exposes window.GIF), same as the original
// static-site <script src> tag. See src/lib/gifEncode.ts for the
// same-origin worker-URL workaround this pairs with.
export function GifEncoderScript() {
  return (
    <Script
      src="https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js"
      strategy="beforeInteractive"
    />
  );
}
