import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Hanken_Grotesk, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/motion/SmoothScroll";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz", "SOFT", "WONK"], variable: "--font-fraunces", display: "swap" });
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
  themeColor: "#fafafa",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${geistMono.variable} ${display.variable} ${signature.variable}`}>
      <body className="min-h-dvh">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
