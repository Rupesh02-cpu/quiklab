import type { Metadata } from "next";
import { UnifiedApp } from "@/components/UnifiedUpload/UnifiedApp";
import { AboutSection } from "@/components/ImageCompressor/AboutSection";
import { FaqJsonLd } from "@/components/ImageCompressor/FaqJsonLd";
import { PdfAboutSection } from "@/components/PdfToolkit/PdfAboutSection";
import { PdfFaqJsonLd } from "@/components/PdfToolkit/PdfFaqJsonLd";
import { GifEncoderScript } from "@/components/GifEncoderScript";

export const metadata: Metadata = {
  title: "QuikLab - image & PDF tools, no upload",
  description:
    "Resize and compress images, and merge, split, compress, rotate, and watermark PDFs, entirely in your browser. No upload, no server, no signup.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "QuikLab - image & PDF tools, no upload",
    description:
      "Resize and compress images, and merge, split, compress, rotate, and watermark PDFs, entirely in your browser.",
    type: "website",
    url: "https://quiklab.online/",
    siteName: "QuikLab",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuikLab - image & PDF tools, no upload",
    description:
      "Resize and compress images, and merge, split, compress, rotate, and watermark PDFs, entirely in your browser.",
    images: ["/og-image.png"],
  },
};

const WEB_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "QuikLab",
  url: "https://quiklab.online/",
  description:
    "Resize and compress JPG, PNG, WebP, SVG, and GIF images, and merge, split, compress, rotate, and watermark PDFs, all entirely in your browser. No upload, no server, no signup.",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_APP_JSON_LD) }} />
      <FaqJsonLd />
      <PdfFaqJsonLd />
      <GifEncoderScript />
      <UnifiedApp initialIntent={null} />
      <AboutSection />
      <PdfAboutSection />
    </>
  );
}
