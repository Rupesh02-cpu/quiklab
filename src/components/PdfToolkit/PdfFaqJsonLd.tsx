const FAQ_ITEMS = [
  {
    question: "Is my PDF uploaded anywhere?",
    answer:
      "No. Every operation: merging, splitting, compressing, rotating, watermarking, and converting, runs in your browser using JavaScript. Your PDF and its contents never leave your device.",
  },
  {
    question: "How does QuikLab compress a PDF?",
    answer:
      "It re-encodes embedded images inside the PDF at a lower quality and removes unused objects, which shrinks image-heavy PDFs substantially. Text-only PDFs are already compact and may not shrink much further.",
  },
  {
    question: "Can I merge PDFs in a specific order?",
    answer: "Yes. Add your files and drag them into the order you want before merging, and the output follows that order.",
  },
  {
    question: "Can I convert images to a PDF, or a PDF to images?",
    answer:
      "Yes, both directions. Image to PDF places each JPG, PNG, or WebP you upload on its own page. PDF to image renders each page of a PDF as a downloadable PNG.",
  },
];

export function PdfFaqJsonLd() {
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
