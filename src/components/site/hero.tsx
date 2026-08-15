import Image from "next/image";
import { ArrowDown, Download, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import {
  OpenChatButton,
  primaryButton,
  secondaryButton,
} from "@/components/chat/open-chat-button";
import { profile, stats } from "@/lib/content";

const contactItems = [
  { icon: MapPin, label: profile.location, href: null },
  { icon: Mail, label: profile.email, href: `mailto:${profile.email}` },
  { icon: Phone, label: profile.phone, href: `tel:${profile.phoneHref}` },
] as const;

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Copper wash bleeding in from the top-right, kept behind everything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-15%] size-[38rem] rounded-full bg-copper-600/12 blur-[120px]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6">
        <div className="grid items-center gap-14 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <p className="label rise text-copper-500">
              Available for consulting &amp; permanent roles
            </p>

            <h1 className="rise mt-6 text-[clamp(2.5rem,7vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white [animation-delay:80ms]">
              {profile.name}
            </h1>

            <div className="rise mt-6 flex items-center gap-4 [animation-delay:140ms]">
              <span className="h-px w-10 shrink-0 bg-copper-500" />
              <p className="font-mono text-sm uppercase tracking-[0.14em] text-copper-400">
                {profile.role}
              </p>
            </div>

            <p className="rise mt-7 max-w-xl text-base leading-relaxed text-mist-300 [animation-delay:200ms]">
              {profile.tagline}
            </p>

            <ul className="rise mt-8 flex flex-wrap gap-x-7 gap-y-3 [animation-delay:260ms]">
              {contactItems.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  {href ? (
                    <a
                      href={href}
                      className="flex items-center gap-2 font-mono text-xs text-mist-300 transition-colors hover:text-copper-400"
                    >
                      <Icon className="size-3.5 text-copper-500" />
                      {label}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 font-mono text-xs text-mist-300">
                      <Icon className="size-3.5 text-copper-500" />
                      {label}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="rise mt-10 flex flex-wrap gap-3 [animation-delay:320ms]">
              <OpenChatButton className={primaryButton}>
                <MessageSquare className="size-4" />
                Ask my assistant
              </OpenChatButton>
              <a href={profile.cv} download className={secondaryButton}>
                <Download className="size-4" />
                Download CV
              </a>
              <a href={profile.certificates} download className={secondaryButton}>
                <Download className="size-4" />
                Certificates
              </a>
            </div>
          </div>

          {/* Portrait, framed like a drawing detail with registration ticks. */}
          <div className="rise relative mx-auto w-full max-w-[19rem] [animation-delay:380ms] lg:mx-0 lg:ml-auto">
            <div className="ticked border border-[color:var(--rule-strong)] p-2.5">
              <div className="relative aspect-square overflow-hidden bg-ink-700">
                <Image
                  src={profile.photo}
                  alt={`${profile.name}, ${profile.role}`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 19rem, 19rem"
                  className="object-cover grayscale-[0.35] transition-[filter] duration-700 hover:grayscale-0"
                />
              </div>
              <div className="flex items-center justify-between px-1 pt-2.5">
                <span className="label">Fig. 01</span>
                <span className="label text-copper-500">{profile.location}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key figures — the drawing's schedule table. */}
        <dl className="mt-20 grid grid-cols-2 border-t border-[color:var(--rule)] sm:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="border-b border-[color:var(--rule)] px-1 py-6 sm:border-b-0 sm:px-0 sm:py-7"
              style={{ borderLeft: index === 0 ? undefined : "1px solid var(--rule)" }}
            >
              <dd className="pl-0 text-3xl font-semibold tracking-tight text-white sm:pl-6">
                {stat.value}
              </dd>
              <dt className="label mt-2 sm:pl-6">{stat.label}</dt>
            </div>
          ))}
        </dl>

        <a
          href="#about"
          aria-label="Scroll to about"
          className="mt-14 inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist-500 transition-colors hover:text-copper-400"
        >
          <ArrowDown className="size-3.5" />
          Continue
        </a>
      </div>
    </section>
  );
}
