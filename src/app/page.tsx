import { ChatDock } from "@/components/chat/chat-dock";
import { About } from "@/components/site/about";
import { Experience } from "@/components/site/experience";
import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { Nav } from "@/components/site/nav";
import { Projects } from "@/components/site/projects";
import { Skills } from "@/components/site/skills";

/**
 * Every section below is a server component — the resume content ships as
 * HTML with no client JavaScript. Only the nav (scroll-spy) and the chat dock
 * hydrate, and the chat panel itself is a separate lazily-loaded chunk.
 */
export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <About />
        <Experience />
        <Projects />
        <Skills />
      </main>
      <Footer />
      <ChatDock />
    </>
  );
}
