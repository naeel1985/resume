import { Section } from "@/components/site/section";
import { certifications } from "@/lib/content";

const sectors = ["Container terminals", "Aviation", "Oil & gas", "Corporate ICT"];

export function About() {
  return (
    <Section id="about" index="01" title="About">
      <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="space-y-5">
          <p className="font-display text-[clamp(1.25rem,2.2vw,1.625rem)] font-medium leading-[1.35] tracking-[-0.015em] text-mist-100">
            I design, deploy and commission the low-voltage and ICT systems that
            keep large facilities running.
          </p>
          <p className="leading-relaxed text-mist-300">
            Structured cabling and fibre, networks, data centres, CCTV and access
            control — and the integration work that ties them together.
          </p>
          <p className="leading-relaxed text-mist-300">
            Most of that work has been in the Gulf: container terminals for Abu
            Dhabi Ports and CMA, the Sharjah Airport expansion, and corporate
            headquarters fit-outs. Before that, telecommunications systems on
            producing oil and gas fields in Iraq.
          </p>
          <p className="leading-relaxed text-mist-300">
            I run projects end to end — design review, procurement, contractor
            coordination, commissioning and handover — and I stay close enough to
            the technical detail to catch problems before they reach site.
          </p>

          <div className="ticked !mt-9 border border-[color:var(--rule)] p-6">
            <p className="label">Sectors</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[0.9375rem] text-mist-100">
              {sectors.map((sector) => (
                <li key={sector} className="flex items-center gap-2.5">
                  <span aria-hidden className="size-1 shrink-0 rotate-45 bg-copper-500" />
                  {sector}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="label">
            Certifications <span className="text-copper-500">/ {certifications.length}</span>
          </p>
          <ul className="mt-5">
            {certifications.map((cert) => (
              <li
                key={cert.short}
                className="border-b border-[color:var(--rule)] py-4 first:border-t"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-lg font-semibold tracking-[-0.01em] text-copper-400">
                    {cert.short}
                  </span>
                  {cert.year ? (
                    <span className="font-mono text-xs text-mist-500">{cert.year}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[0.9375rem] leading-snug text-mist-100">
                  {cert.name}
                </p>
                {cert.body ? <p className="label mt-1.5">{cert.body}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
