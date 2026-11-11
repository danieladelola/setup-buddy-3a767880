import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Sponsors, CTA, Footer } from "@/components/site";

export const Route = createFileRoute("/sponsors")({
  head: () => ({
    meta: [
      { title: "Sponsors — Miss Agriculture Zambia" },
      { name: "description", content: "Platinum, gold, silver and strategic partners powering Miss Agriculture Zambia." },
      { property: "og:title", content: "Sponsors — Miss Agriculture Zambia" },
      { property: "og:description", content: "Powered by partners who believe." },
    ],
  }),
  component: SponsorsPage,
});

function SponsorsPage() {
  return (
    <main className="bg-background text-foreground">

      <PageHero kicker="Sponsors & Partners" title="Powered by partners who" italic="believe." sub="From government ministries to leading agribusinesses and global development partners." />
      <Sponsors showHeader={false} />
      <CTA />
      <Footer />
    </main>
  );
}
