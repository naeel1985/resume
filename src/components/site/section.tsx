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
 * Every content block on the page shares this frame: a monospace section
 * number, the title, and a hairline that reads like a drawing sheet header.
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
    <section id={id} className={cn("scroll-mt-24 py-20 sm:py-28", className)}>
      <div className="mx-auto w-full max-w-6xl px-6">
        <header className="mb-12">
          <div className="flex items-baseline gap-3">
            <span className="label text-copper-500">{index}</span>
            <span aria-hidden className="label text-mist-500">
              /
            </span>
            <h2 className="label text-mist-300">{title}</h2>
          </div>
          <div className="rule mt-4 origin-left" />
          {intro ? (
            <p className="mt-6 max-w-2xl text-[0.9375rem] leading-relaxed text-mist-300">
              {intro}
            </p>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
}
