import type { NextConfig } from "next";
import path from "path";

/**
 * Next.js ana konfigurasyon dosyasi
 *
 * Simdilik burada ekstra kural acmiyorum, cunku proje davranisini sade ve stabil tutmak istedim.
 * Ileride gerekirse buraya cache, image, security ve build optimizasyon ayarlari eklenebilir.
 */
const nextConfig: NextConfig = {
  // Bu ayar, birden fazla package-lock oldugunda Next'in yanlis root secmesini engeller.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
