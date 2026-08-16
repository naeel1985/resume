import { cn } from "@/lib/utils";

type SectionProps = {
  id: string;
  index: string;
  title: string;
  intro?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * Shared frame for every content block: a monospace sheet number, the title as
 * an actual display heading, and a hairline that reads like a drawing header.
 */
export function Section({
  id,
  index,
  title,
  intro,
  className,
  children,
}: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-12 sm:py-16", className)}>
      <div className="mx-auto w-full max-w-6xl px-6">
        <header className="mb-10">
          <span className="label text-copper-500">{index}</span>
          <h2 className="mt-2.5 font-display text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
            {title}
          </h2>
          <div className="rule mt-5" />
          {intro ? (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-mist-300">
              {intro}
            </p>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
}
