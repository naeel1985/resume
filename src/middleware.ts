import { NextResponse, type NextRequest } from "next/server";

/**
 * Injects a per-request CSP nonce.
 *
 * `script-src` is nonce-locked with `strict-dynamic`, so an injected
 * `<script>` cannot execute even if markup ever escapes React's escaping.
 * `style-src` keeps `unsafe-inline` because `next/font` and Tailwind emit
 * inline style blocks; style injection is a far smaller blast radius.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${
      process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""
    }`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ]
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce back out of this request header to stamp its own
  // hydration scripts. Without it, the framework's inline scripts are blocked.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the favicon.
    {
      source: "/((?!_next/static|_next/image|favicon.ico|me/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|txt)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
