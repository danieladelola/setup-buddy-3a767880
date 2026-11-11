import { createFileRoute } from "@tanstack/react-router";
import { PageHero, Contestants, Personalities, Voting, Footer } from "@/components/site";


export const Route = createFileRoute("/contestant")({
  head: () => ({
    meta: [
      { title: "Contestants — Miss Agriculture Zambia 2027" },
      { name: "description", content: "Meet the Miss Agriculture Zambia 2027 contestants, view live voting and discover the personalities shaping the next edition." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Contestants — Miss Agriculture Zambia 2027" },
      { property: "og:description", content: "Meet the women shaping tomorrow at Miss Agriculture Zambia 2027. Vote, follow, and support." },
    ],
  }),
  component: ContestantPage,
});

function ContestantPage() {
  return (
    <main className="bg-background text-foreground">
      <PageHero kicker="Contestant" title="Meet the women" italic="shaping tomorrow." sub="Browse contestant profiles for the Miss Agriculture Zambia 2027 stage." />


      <Contestants
        scope="active"
        label="Active Contestants · 2027"
        title={<>The women on the <span className="italic text-gradient-gold">2027 stage.</span></>}
        sub="The official Miss Agriculture Zambia 2027 contestants — open for voting below."
        emptyMessage={
          <>
            The 2027 contestant roster is being finalised. Check back soon.
          </>
        }
      />

      <Voting />

      <Contestants
        scope="past"
        label="Past Contestants"
        title={<>Miss Agriculture Zambia <span className="italic text-gradient-gold">2026.</span></>}
        sub="A salute to the 2026 class — the women who carried the sash before the 2027 stage opens."
      />

      <Personalities />
      <Footer />

    </main>
  );
}
