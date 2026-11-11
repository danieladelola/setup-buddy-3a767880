import { createFileRoute } from "@tanstack/react-router";
import { PageHero, About, Story, Queen, Testimonials, CTA, Footer } from "@/components/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Miss Agriculture Zambia" },
      { name: "description", content: "Discover the mission, story and reigning queen behind Miss Agriculture Zambia — a national movement for women and agriculture." },
      { property: "og:title", content: "About — Miss Agriculture Zambia" },
      { property: "og:description", content: "More than a crown. A national calling for women, agriculture and identity." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="bg-background text-foreground">

      <PageHero kicker="About" title="More than a crown." italic="A national calling." sub="A groundbreaking national platform empowering young women, promoting agricultural excellence, and showcasing Zambia's rich cultural heritage to the world." />
      <About />
      <Story />
      <Queen />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
