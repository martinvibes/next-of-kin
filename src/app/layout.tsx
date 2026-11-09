import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Libre_Caslon_Text, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const caslonText = Libre_Caslon_Text({ weight: ["400", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-caslon-text", display: "swap" });
const signature = Mrs_Saint_Delafield({ weight: "400", subsets: ["latin"], variable: "--font-signature", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Next of Kin", template: "%s · Next of Kin" },
  description: "Keys open wallets. Memory finds them. Next of Kin watches your wallets, learns what your heir will need to know, and keeps it encrypted on Walrus until it's needed.",
  applicationName: "Next of Kin",
  openGraph: {
    title: "Next of Kin",
    description: "Keys open wallets. Memory finds them.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${caslonText.variable} ${signature.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
