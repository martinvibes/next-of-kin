import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in a parent folder must not change the tracing root.
  outputFileTracingRoot: path.join(__dirname),
  // The Walrus Memory SDK and Sui SDK are Node-side only; keep them out of the bundler.
  serverExternalPackages: ["@mysten-incubation/memwal", "@mysten/sui", "@mysten/seal", "@mysten/walrus"],
  poweredByHeader: false,
};

export default nextConfig;
