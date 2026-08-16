import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";

import { profile } from "@/lib/content";
import "./globals.css";

/** Headings and the nav. Geometric, slightly condensed — carries large sizes. */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

/** Body copy — kept separate from the display face for readability at 16px. */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://naeel.ai-technology.ae";
const description = `${profile.role} in ${profile.location}. PMP, RCDD, RTPM, CSPP, PMP-CPMAI, CCNA and SIRA certified, with 18+ years across container terminals, aviation, oil and gas, and corporate ICT.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${profile.name} — ${profile.role}`,
    template: `%s — ${profile.name}`,
  },
  description,
  applicationName: `${profile.name} · Portfolio`,
  authors: [{ name: profile.name }],
  keywords: [
    "ELV systems",
    "ICT infrastructure",
    "network architecture",
    "data centre",
    "RCDD",
    "PMP",
    "RTPM",
    "CSPP",
    "CPMAI",
    "Abu Dhabi",
    "container terminals",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    url: SITE_URL,
    title: `${profile.name} — ${profile.role}`,
    description,
    siteName: profile.name,
    locale: "en_AE",
    images: [{ url: profile.photo, width: 1200, height: 1200, alt: profile.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${profile.name} — ${profile.role}`,
    description,
    images: [profile.photo],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/**
 * The nonce CSP in src/middleware.ts is minted per request, so the HTML that
 * carries it has to be generated per request too. If this page is statically
 * prerendered, Next bakes its bootstrap scripts at build time with no nonce
 * and `strict-dynamic` blocks every one of them — the page then loads as inert
 * HTML with no nav, no chat, and no hydration.
 *
 * Do not remove this without also removing the nonce from the CSP.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

/** Structured data so search engines read the CV as a person, not a blob. */
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.role,
  email: `mailto:${profile.email}`,
  telephone: profile.phone,
  url: SITE_URL,
  image: `${SITE_URL}${profile.photo}`,
  address: { "@type": "PostalAddress", addressLocality: "Abu Dhabi", addressCountry: "AE" },
  knowsAbout: [
    "ELV systems design",
    "ICT infrastructure",
    "Network architecture",
    "Data centre design",
    "CCTV and access control",
    "Fibre optics",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${geistSans.variable} ${geistMono.variable} blueprint`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-copper-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-900"
        >
          Skip to content
        </a>
        {children}
        {/*
          Deliberately carries no nonce. `application/ld+json` is a data block,
          not executable script, so CSP does not gate it — and the CSP spec
          requires browsers to blank the nonce attribute after parsing, which
          made React report a hydration mismatch against its own server output.
        */}
        <script
          type="application/ld+json"
          // Static, developer-authored object — no user input reaches this.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
      </body>
    </html>
  );
}
