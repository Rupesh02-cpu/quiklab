import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { IconSprite } from "@/components/IconSprite";
import { SiteHeader } from "@/components/SiteHeader";
import { ToastProvider } from "@/components/ToastProvider";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "QuikLab - image compressor",
  description:
    "Resize and compress JPG, PNG, and WebP images entirely in your browser. No upload, no server, no signup. Your images never leave the tab.",
  metadataBase: new URL("https://quiklab.online"),
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "QuikLab - image compressor",
    description:
      "Resize and compress JPG, PNG, and WebP images entirely in your browser. No upload, no server, no signup.",
    type: "website",
    url: "https://quiklab.online/",
    siteName: "QuikLab",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuikLab - image compressor",
    description:
      "Resize and compress JPG, PNG, and WebP images entirely in your browser. No upload, no server, no signup.",
    images: ["/og-image.png"],
  },
  other: {
    "google-adsense-account": "ca-pub-8283943064154546",
  },
};

// Applied before first paint to avoid a flash of the wrong theme. 'system'
// (the default) sets no data-theme attribute, so the prefers-color-scheme
// media query in quiklab.css takes over. Kept as a raw inline script (not
// a React effect) since it has to run before hydration, not after.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem('quiklab-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <IconSprite />
        <SiteHeader />
        <ToastProvider>{children}</ToastProvider>

        {/* Google tag (gtag.js) */}
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-43T0WZB3Z0" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-43T0WZB3Z0');`}
        </Script>

        {/* Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8283943064154546"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        {/*
          Microsoft Clarity — usage analytics (heatmaps + session replay of
          the INTERFACE only: clicks, scroll, DOM structure). It never sees
          image bytes, file contents, or anything drawn to <canvas>.
          Project id yl6fc10ssr is wired to the live dashboard at
          clarity.microsoft.com.
        */}
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", "yl6fc10ssr");`}
        </Script>
      </body>
    </html>
  );
}
