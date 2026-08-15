import { Section } from "@/components/site/section";
import { skills } from "@/lib/content";

export function Skills() {
  return (
    <Section
      id="skills"
      index="04"
      title="Capability"
      intro="Self-assessed depth against the work I take on. Bars are indicative, not a benchmark."
    >
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
        {skills.map((group) => (
          <div key={group.category}>
            <div className="flex items-baseline justify-between border-b border-[color:var(--rule)] pb-3">
              <p className="label text-copper-500">{group.category}</p>
              <p className="label">{group.items.length} areas</p>
            </div>

            <ul className="mt-6 space-y-6">
              {group.items.map((skill, index) => (
                <li key={skill.name}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-mist-100">{skill.name}</span>
                    <span className="font-mono text-xs tabular-nums text-mist-500">
                      {skill.level}
                    </span>
                  </div>
                  <div className="mt-2.5 h-px w-full bg-[color:var(--rule-strong)]">
                    <div
                      className="sweep h-px bg-copper-500"
                      style={{
                        width: `${skill.level}%`,
                        animationDelay: `${index * 90}ms`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
