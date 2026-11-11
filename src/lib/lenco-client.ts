declare global {
  interface Window {
    LencoPay?: { getPaid: (opts: Record<string, unknown>) => void };
  }
}

const SCRIPT_URL = "https://pay.lenco.co/js/v1/inline.js";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.LencoPay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment window. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type LencoOutcome = "success" | "closed" | "pending";

/** Opens the Lenco Pay popup. Always verify on the server afterwards. */
export async function openLencoCheckout(opts: {
  publicKey: string;
  reference: string;
  email: string;
  amount: number;
  label?: string;
  phone?: string;
  name?: string;
}): Promise<LencoOutcome> {
  await loadScript();
  if (!window.LencoPay) throw new Error("Payment window unavailable.");
  const [firstName, ...rest] = (opts.name ?? "").trim().split(/\s+/);
  return new Promise((resolve) => {
    window.LencoPay!.getPaid({
      key: opts.publicKey,
      reference: opts.reference,
      email: opts.email,
      amount: opts.amount,
      currency: "ZMW",
      label: opts.label,
      channels: ["card", "mobile-money"],
      customer: { firstName: firstName || undefined, lastName: rest.join(" ") || undefined, phone: opts.phone || undefined },
      onSuccess: () => resolve("success"),
      onClose: () => resolve("closed"),
      onConfirmationPending: () => resolve("pending"),
    });
  });
}
