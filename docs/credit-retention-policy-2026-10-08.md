# Pixenar Studio Credit & Media Retention Policy — 2026-10-08

## Credit sources

Pixenar Studio keeps credits in source-aware buckets. Credits from different sources must never be merged in a way that changes their expiry rules.

### Monthly subscription credits
- The first subscription day is the billing anchor.
- The next cycle begins on the same calendar day in the next month, as provided by the billing provider.
- Unused monthly subscription credits expire at the cycle boundary.
- They do not roll over to the next monthly cycle.
- Reserved credits for an in-flight generation stay reserved. If a refundable job releases after the source bucket has expired, those credits expire instead of becoming reusable.

### Annual subscription credits
- Annual members receive the plan's monthly credit allowance according to the billing schedule.
- Unused annual-plan credits may roll from month to month during the active annual membership term.
- Annual-plan credit grants expire at the end of the paid annual subscription term unless a later paid renewal explicitly creates a new annual term.
- Renewal must create new uniquely referenced credit grants; it must never duplicate a previous grant.

### Purchased top-up credits
- Top-up credits are a one-time purchase.
- They never expire.
- Every top-up grant must use a unique payment reference.
- Re-delivery or retries of the same payment webhook must return the existing grant and must not add credits again.
- Top-up credits are spent after expiring subscription credits whenever possible.

### Spend order
1. Monthly subscription credits
2. Annual-plan credits
3. Bonus/welcome credits
4. Legacy/admin credits
5. Purchased top-up credits

The system always prioritizes credits that would expire sooner before non-expiring purchased credits.

## Generation charging

- A render reserves its quoted credits before provider submission.
- Successful or provider-billed failed generations consume the reserved source buckets.
- Confirmed refundable failures release the reservation once.
- Uncertain provider billing stays under review rather than automatically refunding.
- A request ID prevents duplicate generation reservations.

## Pricing safety

Current verified render prices are quoted using the lowest net credit value from the current credit-pack catalog.
The pricing engine budgets:
- payment allowance,
- 20% provider/infrastructure reserve,
- and a target contribution margin of 62.5%.

This protects per-generation economics for supported, verified request shapes. It is not an absolute company-profit guarantee because chargebacks, refunds, taxes, promotions/free credits, storage, support and other operating costs exist outside generation cost.

## Video retention

- Every completed scene render gets its own 60-day expiry timestamp.
- Every completed final export gets its own 60-day expiry timestamp.
- The 60-day period starts when that video file completes.
- Pixenar Studio automatically removes expired generated-video files from storage.
- The project/storyboard record may remain after the generated media is removed.
- Members are warned in My Videos to download important media to their device before expiry.
