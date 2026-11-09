import type { Metadata } from "next";
import { SetupFlow } from "@/components/setup/SetupFlow";

export const metadata: Metadata = { title: "Set up your vault · Next of Kin" };

export default function SetupPage() {
  return <SetupFlow />;
}
