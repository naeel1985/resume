import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * The CSP is completed in `src/middleware.ts`, which injects a per-request
 * nonce into `script-src`. Anything static lives here so it is applied even
 * on paths the middleware skips (static assets, images).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // No `output: "standalone"` on purpose. Deployment is `git pull` +
  // `npm install` on the server, so the normal .next build plus node_modules
  // is what Passenger boots via server.js.

  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    // Only local files are served; no remote patterns are allowed on purpose.
    remotePatterns: [],
  },

  experimental: {
    // Ship smaller client bundles for the icon set.
    optimizePackageImports: ["lucide-react"],
  },

  eslint: {
    // cPanel runs `npm install` with NODE_ENV=production, which omits
    // devDependencies — so ESLint is not on the server. Next 15 lints during
    // `next build` by default, which would then fail the deploy. Linting is a
    // local/CI concern; run `npm run lint` before pushing.
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Left enabled deliberately: the build should still fail on a type error.
    // This is why typescript and @types/* live in `dependencies`.
    ignoreBuildErrors: false,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Immutable build assets.
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Never let a proxy or browser cache a chat response.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
