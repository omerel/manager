import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { getSystemName } from "@/lib/branding";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
});

// Evaluated per request — a rename shows in the browser tab without a rebuild.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await getSystemName(),
    description: "מערכת לניהול קריירה של חוקרים, מהנדסים ומפתחים",
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
