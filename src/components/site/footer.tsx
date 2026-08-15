import { Download, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import {
  OpenChatButton,
  primaryButton,
  secondaryButton,
} from "@/components/chat/open-chat-button";
import { navigation, profile } from "@/lib/content";

export function Footer() {
  return (
    <footer id="contact" className="rule mt-8 scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid gap-14 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="label text-copper-500">Get in touch</p>
            <h2 className="mt-5 max-w-lg text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-white">
              Have a project, a role, or a question about a system?
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-mist-300">
              Email or call directly, or ask the assistant — it answers from my
              actual project history and passes anything it cannot answer on to me.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <OpenChatButton className={primaryButton}>
                <MessageSquare className="size-4" />
                Ask my assistant
              </OpenChatButton>
              <a href={`mailto:${profile.email}`} className={secondaryButton}>
                <Mail className="size-4" />
                Email me
              </a>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:gap-8">
            <div>
              <p className="label">Direct</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-start gap-2.5 text-mist-300 transition-colors hover:text-copper-400"
                  >
                    <Mail className="mt-0.5 size-3.5 shrink-0 text-copper-500" />
                    <span className="break-all">{profile.email}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${profile.phoneHref}`}
                    className="flex items-center gap-2.5 text-mist-300 transition-colors hover:text-copper-400"
                  >
                    <Phone className="size-3.5 shrink-0 text-copper-500" />
                    {profile.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2.5 text-mist-300">
                  <MapPin className="size-3.5 shrink-0 text-copper-500" />
                  {profile.location}
                </li>
              </ul>
            </div>

            <div>
              <p className="label">Elsewhere on this page</p>
              <ul className="mt-4 space-y-3 text-sm">
                {navigation.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="flex items-baseline gap-2.5 text-mist-300 transition-colors hover:text-copper-400"
                    >
                      <span className="font-mono text-[0.6875rem] text-copper-500">
                        {item.index}
                      </span>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>

              <p className="label mt-8">Documents</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a
                    href={profile.cv}
                    download
                    className="flex items-center gap-2.5 text-mist-300 transition-colors hover:text-copper-400"
                  >
                    <Download className="size-3.5 shrink-0 text-copper-500" />
                    Curriculum vitae
                  </a>
                </li>
                <li>
                  <a
                    href={profile.certificates}
                    download
                    className="flex items-center gap-2.5 text-mist-300 transition-colors hover:text-copper-400"
                  >
                    <Download className="size-3.5 shrink-0 text-copper-500" />
                    Certificates
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rule mt-16 flex flex-col gap-3 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="label">
            © {new Date().getFullYear()} {profile.name}
          </p>
          <p className="label">Next.js · TypeScript · Claude Haiku 4.5</p>
        </div>
      </div>
    </footer>
  );
}
