import { Section } from "@/components/site/section";
import { certifications } from "@/lib/content";

export function About() {
  return (
    <Section id="about" index="01" title="About">
      <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <p className="text-lg leading-relaxed text-mist-100">
            I design, deploy and commission the low-voltage and ICT systems that
            keep large facilities running — structured cabling and fibre, networks,
            data centres, CCTV and access control, and the integration work that
            ties them together.
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

          <div className="ticked mt-10 border border-[color:var(--rule)] p-6">
            <p className="label">Sectors</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-mist-100">
              {["Container terminals", "Aviation", "Oil & gas", "Corporate ICT"].map(
                (sector) => (
                  <li key={sector} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-1 shrink-0 rotate-45 bg-copper-500"
                    />
                    {sector}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        <div>
          <p className="label">Certifications</p>
          <ul className="mt-5">
            {certifications.map((cert) => (
              <li
                key={cert.short}
                className="group flex items-start gap-4 border-b border-[color:var(--rule)] py-5 first:border-t"
              >
                <span className="mt-0.5 w-14 shrink-0 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-copper-500">
                  {cert.short}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug text-mist-100">
                    {cert.name}
                  </span>
                  <span className="label mt-1.5 block">
                    {cert.body} · {cert.year}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
