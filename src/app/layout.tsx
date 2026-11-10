import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif, Inter, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { Toaster } from "@/components/ui/Toast";

const sans = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-inter", display: "swap" });
const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
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
    <html lang="en" className={`${sans.variable} ${serif.variable} ${geistMono.variable} ${signature.variable}`}>
      <body className="min-h-dvh">
        <SmoothScroll />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
