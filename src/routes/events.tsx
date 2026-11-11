import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Events, CTA, Footer } from "@/components/site";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Miss Agriculture Zambia" },
      { name: "description", content: "Auditions, galas, the grand finale and the agricultural innovation summit — the official Miss Agriculture Zambia calendar." },
      { property: "og:title", content: "Events — Miss Agriculture Zambia" },
      { property: "og:description", content: "The journey, date by date." },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  return (
    <main className="bg-background text-foreground">

      <PageHero kicker="Events" title="The journey," italic="date by date." sub="Auditions, showcases, the grand finale and the innovation summit — mark your calendar." />
      <Events showHeader={false} />
      <CTA />
      <Footer />
    </main>
  );
}
