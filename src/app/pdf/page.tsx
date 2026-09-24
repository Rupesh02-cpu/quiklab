import type { Metadata } from "next";
import { UnifiedApp } from "@/components/UnifiedUpload/UnifiedApp";
import { PdfAboutSection } from "@/components/PdfToolkit/PdfAboutSection";
import { PdfFaqJsonLd } from "@/components/PdfToolkit/PdfFaqJsonLd";

export const metadata: Metadata = {
  title: "QuikLab - PDF toolkit",
  description:
    "Merge, split, compress, rotate, and watermark PDFs, and convert between PDF and images, entirely in your browser. No upload, no server, no signup.",
  alternates: { canonical: "/pdf" },
  openGraph: {
    title: "QuikLab - PDF toolkit",
    description:
      "Merge, split, compress, rotate, and watermark PDFs, and convert between PDF and images, entirely in your browser.",
    type: "website",
    url: "https://quiklab.online/pdf",
    siteName: "QuikLab",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuikLab - PDF toolkit",
    description:
      "Merge, split, compress, rotate, and watermark PDFs, and convert between PDF and images, entirely in your browser.",
    images: ["/og-image.png"],
  },
};

const WEB_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "QuikLab",
  url: "https://quiklab.online/pdf",
  description:
    "Merge, split, compress, rotate, and watermark PDFs, and convert between PDF and images, entirely in your browser. No upload, no server, no signup.",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function PdfPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_APP_JSON_LD) }} />
      <PdfFaqJsonLd />
      <UnifiedApp initialIntent="pdf" />
      <PdfAboutSection />
    </>
  );
}
