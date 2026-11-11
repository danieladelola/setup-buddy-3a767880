import { createFileRoute } from "@tanstack/react-router";
import { Hero, AboutTeaser, Impact, CTA, Footer, heroMain } from "@/components/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Miss Agriculture Zambia — Empowering Women. Advancing Agriculture." },
      { name: "description", content: "A national platform empowering women through agriculture, leadership, entrepreneurship, culture, tourism, and community impact." },
      { property: "og:title", content: "Miss Agriculture Zambia" },
      { property: "og:description", content: "Where beauty meets purpose, leadership creates impact, and agriculture builds the future." },
      { property: "og:image", content: heroMain.url },
      { name: "twitter:image", content: heroMain.url },
    ],
    links: [
      { rel: "preload", as: "image", href: heroMain.url, fetchpriority: "high" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="bg-background text-foreground">

      <Hero />
      <AboutTeaser />
      <Impact />
      <CTA />
      <Footer />
    </main>
  );
}
