"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { navigation, profile } from "@/lib/content";
import { cn } from "@/lib/utils";

const SECTION_IDS = navigation.map((item) => item.id);

export function Nav() {
  const [active, setActive] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Scroll-spy via IntersectionObserver rather than a scroll handler — no
     layout reads on every frame, so scrolling stays smooth on mobile. */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.5, 1] },
    );

    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled
          ? "border-b border-[color:var(--rule)] bg-ink-800/85 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6"
      >
        <a
          href="#top"
          className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-mist-100 transition-colors hover:text-copper-400"
        >
          {profile.name}
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {navigation.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active === item.id ? "true" : undefined}
                className={cn(
                  "group flex items-baseline gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors",
                  active === item.id
                    ? "text-copper-400"
                    : "text-mist-500 hover:text-mist-100",
                )}
              >
                <span className="opacity-50">{item.index}</span>
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="-mr-2 p-2 text-mist-300 md:hidden"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {menuOpen ? (
        <div className="border-t border-[color:var(--rule)] bg-ink-800/95 backdrop-blur-md md:hidden">
          <ul className="mx-auto w-full max-w-6xl px-6 py-3">
            {navigation.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-baseline gap-3 border-b border-[color:var(--rule)] py-3 font-mono text-xs uppercase tracking-[0.16em] text-mist-300 last:border-0"
                >
                  <span className="text-copper-500">{item.index}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
