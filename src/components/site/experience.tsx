import { Section } from "@/components/site/section";
import { experience } from "@/lib/content";

export function Experience() {
  return (
    <Section
      id="experience"
      index="02"
      title="Experience"
      intro="Most recent roles. The full history, including the Iraq oil and gas years, is in the CV."
    >
      <ol className="relative">
        {/* The spine. Hidden on mobile where the layout stacks. */}
        <span
          aria-hidden
          className="absolute left-[5.5rem] top-2 hidden h-[calc(100%-1rem)] w-px bg-[color:var(--rule)] sm:block"
        />

        {experience.map((role) => (
          <li
            key={`${role.company}-${role.year}`}
            className="relative grid gap-4 border-b border-[color:var(--rule)] py-8 first:border-t sm:grid-cols-[5.5rem_1fr] sm:gap-8"
          >
            <div className="flex items-center gap-3 sm:block">
              <span className="font-mono text-sm font-medium text-copper-400">
                {role.year}
              </span>
              {role.current ? (
                <span className="label blink mt-2 flex items-center gap-1.5 text-copper-500">
                  <span aria-hidden className="size-1.5 rounded-full bg-copper-500" />
                  Current
                </span>
              ) : null}
            </div>

            <div className="sm:pl-8">
              {/* Node on the spine, aligned with the role title. */}
              <span
                aria-hidden
                className="absolute left-[5.5rem] top-[2.35rem] hidden size-1.5 -translate-x-1/2 rotate-45 bg-copper-500 sm:block"
              />

              <h3 className="text-lg font-medium leading-snug text-white">
                {role.title}
              </h3>
              <p className="mt-1 text-sm text-copper-400">{role.company}</p>
              <p className="label mt-2">
                {role.duration} · {role.location}
              </p>

              <ul className="mt-4 space-y-2">
                {role.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-3 text-sm leading-relaxed text-mist-300"
                  >
                    <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-copper-600" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
