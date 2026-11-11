import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/policy-page";

export const Route = createFileRoute("/cancellation-policy")({
  head: () => ({
    meta: [
      { title: "Cancellation Policy — Miss Agriculture Zambia" },
      { name: "description", content: "How to cancel a Miss Agriculture Zambia ticket and what happens if an event is cancelled or rescheduled." },
      { property: "og:title", content: "Cancellation Policy — Miss Agriculture Zambia" },
      { property: "og:description", content: "Ticket cancellations, event changes and rescheduling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PolicyPage title="Cancellation" italic="Policy." sub="What happens when plans change — yours or ours.">
      <div><h2>Cancelling your ticket</h2><ul>
        <li>You may cancel a ticket by emailing us with your payment reference.</li>
        <li>Refunds for cancelled tickets follow our Refund Policy (full refund 7+ days before the event).</li>
        <li>Instead of cancelling, you may transfer your ticket to another person free of charge up to 24 hours before the event.</li>
      </ul></div>
      <div><h2>If we cancel or reschedule</h2><ul>
        <li>If an event is cancelled, all ticket holders receive a full refund.</li>
        <li>If an event is rescheduled, your ticket stays valid for the new date, or you may request a full refund within 7 days of the announcement.</li>
        <li>We notify ticket holders by phone, email or SMS and on this website.</li>
      </ul></div>
      <div><h2>Circumstances beyond our control</h2><p>For weather, public health or government directives, we will reschedule where possible and offer refunds as described above.</p></div>
    </PolicyPage>
  ),
});
