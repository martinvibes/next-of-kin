import type { Metadata } from "next";
import { OwnerApp } from "@/components/owner/OwnerApp";

export const metadata: Metadata = { title: "Your vault · Next of Kin" };

export default function OwnerPage() {
  return <OwnerApp />;
}
