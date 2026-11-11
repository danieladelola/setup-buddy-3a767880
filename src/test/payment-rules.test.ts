import { describe, expect, it } from "vitest";
import { decidePayment, voteAmount, PAYMENT_REF_PATTERN } from "@/lib/payment-rules";

const order = { reference: "vote-1-abc", amount: 25 };
const ok = { status: "successful", amount: "25.00", currency: "ZMW", reference: "vote-1-abc" };

describe("payment verification rules", () => {
  it("counts a successful ZMW payment of the full amount for the same reference", () => {
    expect(decidePayment(ok, order).outcome).toBe("paid");
  });

  it("never counts a payment Lenco has no record of", () => {
    expect(decidePayment(null, order).outcome).toBe("pending");
  });

  it("never counts pending, pay-offline or 3ds payments", () => {
    for (const status of ["pending", "pay-offline", "3ds-auth-required"]) {
      expect(decidePayment({ ...ok, status }, order).outcome).toBe("pending");
    }
  });

  it("marks failed payments as failed", () => {
    expect(decidePayment({ ...ok, status: "failed" }, order).outcome).toBe("failed");
  });

  it("sends an underpaid payment to review instead of counting it", () => {
    expect(decidePayment({ ...ok, amount: "24.99" }, order).outcome).toBe("review");
  });

  it("sends a payment in another currency to review", () => {
    expect(decidePayment({ ...ok, currency: "USD" }, order).outcome).toBe("review");
  });

  it("sends a payment for a different reference to review", () => {
    expect(decidePayment({ ...ok, reference: "vote-2-xyz" }, order).outcome).toBe("review");
  });

  it("prices votes as quantity times price per vote, to the cent", () => {
    expect(voteAmount(3, 2.5)).toBe(7.5);
    expect(voteAmount(10, 0.1)).toBe(1);
  });

  it("only accepts vote and ticket references", () => {
    expect(PAYMENT_REF_PATTERN.test("vote-123-abc")).toBe(true);
    expect(PAYMENT_REF_PATTERN.test("tkt-123-abc")).toBe(true);
    expect(PAYMENT_REF_PATTERN.test("other-123")).toBe(false);
  });
});
