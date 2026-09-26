import type { Metadata } from "next";
import { ConverterApp } from "@/components/Converter/ConverterApp";

export const metadata: Metadata = {
  title: "QuikLab - file converter",
  description:
    "Convert HEIC photos, Word documents, CSV, JSON, and Markdown files entirely in your browser. No upload, no server, no signup.",
  alternates: { canonical: "/convert" },
  openGraph: {
    title: "QuikLab - file converter",
    description: "Convert HEIC photos, Word documents, CSV, JSON, and Markdown files entirely in your browser.",
    type: "website",
    url: "https://quiklab.online/convert",
    siteName: "QuikLab",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuikLab - file converter",
    description: "Convert HEIC photos, Word documents, CSV, JSON, and Markdown files entirely in your browser.",
    images: ["/og-image.png"],
  },
};

const WEB_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "QuikLab",
  url: "https://quiklab.online/convert",
  description:
    "Convert HEIC photos, Word documents, CSV, JSON, and Markdown files entirely in your browser. No upload, no server, no signup.",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function ConvertPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_APP_JSON_LD) }} />
      <ConverterApp />
    </>
  );
}
