import type { ReactNode } from "react";
import { PageHero, Footer } from "@/components/site";

export function PolicyPage({ title, italic, sub, children }: { title: string; italic: string; sub: string; children: ReactNode }) {
  return (
    <main className="bg-background text-foreground">
      <PageHero kicker="Policy" title={title} italic={italic} sub={sub} />
      <section className="py-16 md:py-24">
        <div className="container-luxe max-w-3xl space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
          <p className="text-xs uppercase tracking-[0.2em] text-gold-deep">Last updated: October 15, 2026</p>
          {children}
          <div>
            <h2>Contact us</h2>
            <p>Email: info@missagriculturezambia.com<br />Phone: +260 963 001 083 / +260 973 470 303<br />Address: LSSP 95 B, Chipata, Eastern Province, Zambia</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
