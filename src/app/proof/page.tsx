import type { Metadata } from "next";
import { ProofApp } from "@/components/proof/ProofApp";

export const metadata: Metadata = { title: "Proof · Next of Kin" };

export default function ProofPage() {
  return <ProofApp />;
}
