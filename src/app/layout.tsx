import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Libre_Caslon_Display, Libre_Caslon_Text, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";

const caslonDisplay = Libre_Caslon_Display({ weight: "400", subsets: ["latin"], variable: "--font-caslon-display", display: "swap" });
const caslonText = Libre_Caslon_Text({ weight: ["400", "700"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-caslon-text", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap", axes: ["wdth"] });
const plexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex-mono", display: "swap" });
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
  themeColor: "#e8e6e0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${caslonDisplay.variable} ${caslonText.variable} ${instrument.variable} ${plexMono.variable} ${signature.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
