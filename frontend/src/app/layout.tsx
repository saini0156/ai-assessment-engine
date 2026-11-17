import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HideOnAdmin, PageMain } from "@/components/admin/AdminAware";

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "MindMark | Syllabus to Practice Quizzes",
  description: "Turn a syllabus into practice quizzes with instant, plain-language explanations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={serif.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-screen flex-col overflow-x-clip bg-[#fdfaf6] text-stone-900 antialiased">
        <Script
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
          strategy="lazyOnload"
        />
        <HideOnAdmin>
          <Navbar />
        </HideOnAdmin>

        <PageMain>{children}</PageMain>

        <HideOnAdmin>
          <Footer />
        </HideOnAdmin>
      </body>
    </html>
  );
}