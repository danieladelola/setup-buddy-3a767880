# Roadmap

## Voting & payments overhaul
- [ ] Payment verification rules (pure, tested): only Lenco "successful" + right amount/currency/reference counts
- [ ] finalizePayment: record Lenco details, mismatch -> review, late success after fail still counts, abandoned stale pending
- [ ] Webhook handles collection.successful / failed / settled
- [ ] Re-check pending payments (admin bulk + per row)
- [ ] Fraud scan never removes paid votes; keeps counters in sync
- [ ] Admin: payments page (references, status, filters, CSV), accurate stats (sum of vote quantities, paid only), counter integrity check + fix
- [ ] Dashboard figures use paid votes only
- [ ] Public: clear payment status steps in vote dialog, polling, resume pending payment after reload, live standings
- [ ] End-to-end test against a local Postgres with simulated Lenco
- Blocked: live Lenco test needs DATABASE_URL + Lenco keys from the owner
