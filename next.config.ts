import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist ships a Node.js-only fallback path (`require("canvas")`)
  // inside its main bundle for server-side rendering support we don't use
  // — the PDF toolkit only ever calls it from the browser via a dynamic
  // import (see src/lib/pdfProcessing.ts). Both bundlers need to be told
  // not to resolve that optional native dependency, or the build fails
  // trying to bundle a module that isn't installed.
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/emptyModule.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
