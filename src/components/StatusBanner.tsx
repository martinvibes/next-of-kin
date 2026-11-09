"use client";

import { useEffect, useState } from "react";
import type { StatusResponse } from "@/lib/api-types";
import { api } from "@/lib/client";
import { ModeBanner } from "./ModeBanner";

/** Mode banner for server-rendered pages: fetches status, shows only when something isn't real. */
export function StatusBanner() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  useEffect(() => {
    api<StatusResponse>("/api/status").then(setStatus).catch(() => {});
  }, []);
  return <ModeBanner status={status} />;
}
