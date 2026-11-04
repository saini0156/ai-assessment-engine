import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "QuizPro | Syllabus to Practice Quizzes",
  description: "Turn a syllabus into practice quizzes with instant, plain-language explanations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={serif.variable}>
      <body className="flex min-h-screen flex-col overflow-x-clip bg-[#fdfaf6] text-stone-900 antialiased">
        <Navbar />
        <main className="mx-auto max-w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <Footer />
      </body>
    </html>
  );
}