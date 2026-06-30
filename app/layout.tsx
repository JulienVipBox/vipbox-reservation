import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIPBOX — Réservation",
  description: "Réservez votre photobooth VIPBOX en ligne",
  icons: {
    icon: "https://www.vip-box.fr/wp-content/uploads/2026/06/cropped-Logo_VIPBOX_2026-06-09-7.png",
    shortcut:
      "https://www.vip-box.fr/wp-content/uploads/2026/06/cropped-Logo_VIPBOX_2026-06-09-7.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
