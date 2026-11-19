
import type { Metadata, Viewport } from "next";
import { Playfair_Display, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HideOnAdmin, PageMain } from "@/components/admin/AdminAware";

const hindiFont = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  display: "swap",
  variable: "--font-hindi",
});

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "MindMark | Syllabus to Practice Quizzes",
  description:
    "Turn a syllabus into practice quizzes with instant, plain-language explanations.",
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
    <html lang="en" className={`${serif.variable} ${hindiFont.variable}`}>
      <body
        className={`${hindiFont.className} flex min-h-screen flex-col overflow-x-clip bg-[#fdfaf6] text-stone-900 antialiased`}
      >
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
