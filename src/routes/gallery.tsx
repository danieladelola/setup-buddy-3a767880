import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Gallery, PressConference2026, Footer } from "@/components/site";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Miss Agriculture Zambia" },
      { name: "description", content: "Featured moments, cultural showcases and press coverage from Miss Agriculture Zambia." },
      { property: "og:title", content: "Gallery — Miss Agriculture Zambia" },
      { property: "og:description", content: "Moments that defined a movement." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <main className="bg-background text-foreground">

      <PageHero kicker="Gallery" title="Moments that" italic="defined a movement." sub="A visual chronicle of finales, cultural showcases, community projects and national milestones." />
      <Gallery showHeader={false} />
      <PressConference2026 />
      <Footer />
    </main>
  );
}
