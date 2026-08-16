import { Section } from "@/components/site/section";
import { projects } from "@/lib/content";

export function Projects() {
  return (
    <Section
      id="projects"
      index="03"
      title="Selected projects"
      intro="Four projects that cover the range — port operations, aviation, corporate security, and industrial telecoms."
    >
      <div className="grid gap-px border border-[color:var(--rule)] bg-[color:var(--rule)] sm:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.title}
            className="group relative bg-ink-800 p-7 transition-colors duration-300 hover:bg-ink-700"
          >
            {/* Copper edge that draws in on hover. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-copper-500 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
            />

            <div className="flex items-center justify-between gap-4">
              <span className="label text-copper-500">{project.sector}</span>
              <span className="font-mono text-xs text-mist-500">{project.year}</span>
            </div>

            <h3 className="mt-5 font-display text-xl font-semibold leading-snug tracking-[-0.015em] text-white">
              {project.title}
            </h3>
            <p className="mt-1 text-sm text-mist-500">{project.company}</p>

            <p className="mt-4 text-sm leading-relaxed text-mist-300">
              {project.description}
            </p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {project.technologies.map((tech) => (
                <li
                  key={tech}
                  className="border border-[color:var(--rule)] px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.04em] text-mist-300"
                >
                  {tech}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  );
}
