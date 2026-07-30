import type { NextConfig } from "next";

// Allow access through proxied hostnames (dev resources + Server Action CSRF check).
// In production (e.g. an OpenShift route), add hostnames via ALLOWED_ORIGINS
// (comma-separated) — the config file is evaluated at server start, so runtime
// env works.
const PROXY_HOSTS = [
  "srv-elgrably.tail3b0882.ts.net",
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: PROXY_HOSTS,
  // Pin the workspace root to this app (silences the multi-lockfile inference warning).
  turbopack: { root: import.meta.dirname },
  experimental: {
    serverActions: {
      allowedOrigins: PROXY_HOSTS,
      bodySizeLimit: "10mb", // allow file uploads on the evaluations page
    },
  },
};

export default nextConfig;
