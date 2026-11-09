import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { StatusBanner } from "@/components/StatusBanner";
import { Hero } from "@/components/landing/Hero";
import { BuiltOn, Faq, Promises, Roots } from "@/components/landing/Sections";

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-bg">
      <StatusBanner />
      <SiteHeader overlay />
      <main id="main">
        <Hero />
        <Roots />
        <Promises />
        <BuiltOn />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
