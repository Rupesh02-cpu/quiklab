const FAQ_ITEMS = [
  {
    question: "How does QuikLab compress images?",
    answer:
      "For JPG and WebP, QuikLab re-encodes the image at a lower quality setting using the browser's built-in Canvas API, which typically shrinks photos by 20 to 60 percent with little visible difference. You can either pick a quality level directly, or tell QuikLab a target file size and it searches for the highest quality that still fits. PNG files are lossless by nature, so QuikLab only resizes them unless a smaller result is actually possible. SVG files are minified by stripping unnecessary comments and editor metadata.",
  },
  {
    question: "Is it safe to compress images with QuikLab?",
    answer:
      "Yes. QuikLab never uploads your images anywhere. All processing happens locally in your browser using JavaScript and the Canvas API, so your files stay on your device the entire time.",
  },
  {
    question: "Does compressing an image reduce its quality?",
    answer:
      "JPG and WebP compression is lossy, so a lower quality setting can introduce visible artifacts if pushed too far. QuikLab defaults to a quality level that keeps files small while staying visually close to the original, and it never returns a compressed file that's larger than what you uploaded.",
  },
  {
    question: "What file types does QuikLab support?",
    answer:
      "QuikLab accepts JPG, PNG, WebP, SVG, and GIF files, and can convert between JPG, PNG, and WebP on output. Animated GIFs stay animated and keep their own format.",
  },
  {
    question: "Does QuikLab remove EXIF and GPS data from photos?",
    answer:
      "Yes, when a JPEG is actually re-encoded, which is the normal case. Re-encoding through the Canvas API produces a new file with no metadata, including camera details and GPS location. The one exception is when compressing wouldn't shrink the file at all, in which case QuikLab keeps the original bytes untouched rather than handing back something bigger, and in that specific case the original metadata stays too.",
  },
];

export function FaqJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}
