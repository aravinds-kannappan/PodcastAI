import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pdfjs-dist"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
