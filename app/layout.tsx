/**
 * Root layout dosyası
 *
 * Bu dosyada uygulamanın tüm sayfalarda ortak olacak iskeletini kuruyorum.
 * Fontlar, metadata ve global CSS burada bağlanıyor.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Ana metin fontu
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Kod / teknik metinler için mono font
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Belge Donusturucu | Staj Projesi",
  description:
    "Word, Excel ve gorsel dosyalarini PDF'e ceviren ve ZIP olarak indiren web uygulamasi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
