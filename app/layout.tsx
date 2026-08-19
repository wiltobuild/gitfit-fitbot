import type { Metadata } from "next";
import { Baloo_2, Inter } from "next/font/google";
import { ChatbotOverlay } from "@/app/components/chatbot-overlay";
import RouteProgress from "@/app/components/route-progress";
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <html lang="en" className={`${baloo2.variable} ${inter.variable}`}>
      <body><RouteProgress />{children}{session && <ChatbotOverlay />}</body>
    </html>
  );
}
