import os from "os";
import type { NextConfig } from "next";

// Hostnames the app may be reached through (dev resources + Server Action CSRF
// check). In production (e.g. an OpenShift route), add hostnames via
// ALLOWED_ORIGINS (comma-separated) — the config file is evaluated at server
// start, so runtime env works.
//
// The machine's own hostname is included in BOTH forms, bare and fully
// qualified. Only the FQDN was listed once, and reaching the app at the bare
// name (http://srv-elgrably:4321) made Next block its own dev resources — HMR
// and chunk requests were refused, so nothing hydrated: file drag-and-drop, the
// admin dropdown and every other client component were silently dead while the
// server-rendered page looked fine. The only trace was a warning in the server
// log; the browser console showed nothing but unrelated extension noise.
const HOSTNAME = os.hostname(); // e.g. "srv-elgrably"
const BARE_HOSTNAME = HOSTNAME.split(".")[0];

const PROXY_HOSTS = [
  ...new Set([
    HOSTNAME,
    BARE_HOSTNAME,
    "srv-elgrably.tail3b0882.ts.net",
    ...(process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
  ]),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: PROXY_HOSTS,
  // Bulk intake moved onto the people page. This stays a framework-level
  // redirect rather than a page that calls redirect(): such a page has no
  // dynamic signal, so `next build` prerenders it — and prerendering runs the
  // root layout's generateMetadata, which reads branding from the database.
  // The image is built with no database, so that one static page failed the
  // whole air-gap build.
  async redirects() {
    return [{ source: "/people/intake", destination: "/people", permanent: false }];
  },
  // Pin the workspace root to this app (silences the multi-lockfile inference warning).
  turbopack: { root: import.meta.dirname },
  experimental: {
    serverActions: {
      allowedOrigins: PROXY_HOSTS,
      // Bulk intake posts a whole batch of personnel documents in one form —
      // several scanned PDFs pass 10mb easily, and overflowing the limit kills
      // the action with an opaque "Unexpected end of form" 500.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
