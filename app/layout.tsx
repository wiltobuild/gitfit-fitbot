import type { Metadata, Viewport } from "next";
import { Baloo_2, Inter } from "next/font/google";
import { ChatbotOverlay } from "@/app/components/chatbot-overlay";
import RouteProgress from "@/app/components/route-progress";
import { Toaster } from "@/app/components/toaster";
import { getSession } from "@/lib/auth/session";
import "./globals.css";

const baloo2 = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo-2",
  display: "swap"
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "GitFit | Your fitness team, in one chat",
  description: "GitFit helps you turn fitness intentions into your next move."
};

export const viewport: Viewport = { themeColor: "#141B3C" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <html lang="en" className={`${baloo2.variable} ${inter.variable}`}>
      <body><Toaster><RouteProgress />{children}{session && <ChatbotOverlay />}</Toaster></body>
    </html>
  );
}
