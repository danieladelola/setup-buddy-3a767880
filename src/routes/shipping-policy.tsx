import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy-page";

export const Route = createFileRoute("/shipping-policy")({
  head: () => ({
    meta: [
      { title: "Shipping & Delivery Policy — Miss Agriculture Zambia" },
      { name: "description", content: "How Miss Agriculture Zambia tickets and confirmations are delivered after purchase." },
      { property: "og:title", content: "Shipping & Delivery Policy — Miss Agriculture Zambia" },
      { property: "og:description", content: "Digital delivery of tickets and confirmations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PolicyPage title="Shipping & Delivery" italic="Policy." sub="How your tickets and confirmations reach you.">
      <div><h2>Digital delivery</h2><ul>
        <li>All event tickets are digital. No physical items are shipped.</li>
        <li>Your ticket or registration confirmation is delivered by email and/or SMS immediately after payment, and no later than 24 hours.</li>
        <li>Show your digital ticket (on your phone or printed) at the event entrance.</li>
      </ul></div>
      <div><h2>Not received?</h2><p>Check your spam folder first. If your ticket hasn't arrived within 24 hours, contact us with your payment reference and we will resend it.</p></div>
      <div><h2>Delivery cost</h2><p>Digital delivery is free. There are no shipping fees.</p></div>
    </PolicyPage>
  ),
});
