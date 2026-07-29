import type { NextConfig } from "next";

// Allow access through the Tailscale hostname (dev resources + Server Action CSRF check),
// so the app and its mutations work when opened via the proxied host, not just localhost.
const PROXY_HOSTS = ["srv-elgrably.tail3b0882.ts.net"];

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
