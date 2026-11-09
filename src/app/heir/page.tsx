import type { Metadata } from "next";
import { HeirApp } from "@/components/heir/HeirApp";

export const metadata: Metadata = { title: "A letter for you · Next of Kin" };

export default function HeirPage() {
  return <HeirApp />;
}
