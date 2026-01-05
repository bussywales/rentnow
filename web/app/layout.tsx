import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { MainNav } from "@/components/layout/MainNav";
import { Footer } from "@/components/layout/Footer";
import { ToastNotice } from "@/components/layout/ToastNotice";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { PwaServiceWorker } from "@/components/layout/PwaServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "RENTNOW | Rentals across Africa",
  description:
    "Search, list, and manage African rentals with AI-assisted search and Supabase-powered dashboards.",
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-900`}
      >
        <MainNav />
        <Suspense fallback={null}>
          <ToastNotice />
        </Suspense>
        <OfflineIndicator />
        <PwaServiceWorker />
        <main className="min-h-[80vh] pb-12 pt-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
