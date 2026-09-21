import type { Metadata } from "next";
import { ImageCompressorApp } from "@/components/ImageCompressor/ImageCompressorApp";
import { AboutSection } from "@/components/ImageCompressor/AboutSection";
import { FaqJsonLd } from "@/components/ImageCompressor/FaqJsonLd";
import { GifEncoderScript } from "@/components/GifEncoderScript";

export const metadata: Metadata = {
  title: "QuikLab - image compressor",
  alternates: { canonical: "/" },
};

const WEB_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "QuikLab",
  url: "https://quiklab.online/",
  description:
    "Resize and compress JPG, PNG, and WebP images entirely in your browser. No upload, no server, no signup.",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_APP_JSON_LD) }} />
      <FaqJsonLd />
      <GifEncoderScript />
      <ImageCompressorApp />
      <AboutSection />
    </>
  );
}
