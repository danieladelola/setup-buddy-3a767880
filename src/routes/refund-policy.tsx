import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy-page";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Miss Agriculture Zambia" },
      { name: "description", content: "How refunds work for Miss Agriculture Zambia event tickets, votes and other payments." },
      { property: "og:title", content: "Refund Policy — Miss Agriculture Zambia" },
      { property: "og:description", content: "Refund terms for tickets, votes and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PolicyPage title="Refund" italic="Policy." sub="Clear, fair terms for every ticket and payment.">
      <div><h2>Event tickets</h2><ul>
        <li>Tickets are refundable in full if requested at least 7 days before the event date.</li>
        <li>Requests made 3–6 days before the event receive a 50% refund.</li>
        <li>Tickets are non-refundable within 48 hours of the event or after the event has started.</li>
        <li>If we cancel an event, you receive a full refund automatically.</li>
      </ul></div>
      <div><h2>Votes and fees</h2><ul>
        <li>Paid votes are final once counted and cannot be refunded.</li>
        <li>Duplicate or failed charges are refunded in full after verification.</li>
      </ul></div>
      <div><h2>How to request a refund</h2><p>Email us with your name, phone number, payment reference and event name. Approved refunds are returned to the original payment method (Airtel Money, MTN Money or bank card) within 7–14 business days.</p></div>
    </PolicyPage>
  ),
});
