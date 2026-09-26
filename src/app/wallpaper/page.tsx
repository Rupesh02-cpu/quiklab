import type { Metadata } from "next";
import { WallpaperFitApp } from "@/components/WallpaperFit/WallpaperFitApp";

export const metadata: Metadata = {
  title: "QuikLab - wallpaper fit",
  description:
    "Crop a photo to your exact phone screen resolution with a live drag/zoom preview, entirely in your browser. No upload, no server, no signup.",
  alternates: { canonical: "/wallpaper" },
  openGraph: {
    title: "QuikLab - wallpaper fit",
    description:
      "Crop a photo to your exact phone screen resolution with a live drag/zoom preview, entirely in your browser.",
    type: "website",
    url: "https://quiklab.online/wallpaper",
    siteName: "QuikLab",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuikLab - wallpaper fit",
    description:
      "Crop a photo to your exact phone screen resolution with a live drag/zoom preview, entirely in your browser.",
    images: ["/og-image.png"],
  },
};

const WEB_APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "QuikLab",
  url: "https://quiklab.online/wallpaper",
  description:
    "Crop a photo to your exact phone screen resolution with a live drag/zoom preview, entirely in your browser. No upload, no server, no signup.",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function WallpaperPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEB_APP_JSON_LD) }} />
      <WallpaperFitApp />
    </>
  );
}
