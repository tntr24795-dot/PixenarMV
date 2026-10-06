# Video pricing — 2026-10-06

Credits are per output second, with 720p as default.

| Model/provider | 480p | 720p | 1080p |
| --- | ---: | ---: | ---: |
| Wan 3.0 / Alibaba Virginia | 5 | 10 | 19 |
| Wan 3.0 Prime / Alibaba Virginia | 8 | 16 | 32 |
| Runway Gen 4.5 / Runway Dev | unsupported | 14 | unsupported |

WAN duration: every integer from 2 to 30. Runway: 6, 8, 10.

API-only gross margins on the lowest-value pack ($79.99/3500) are Standard 63.90%, 63.90%, 62.00%; Prime 65.21%; Runway 62.50%. Prime is approximately 65% due to integer rounding. Smaller packs earn a higher margin. These are not net-profit guarantees: payment fees, provider taxes, infrastructure, paid failures, refunds and free credits require separate cost accounting. No reference-video inputs are accepted by this adapter, so unpriced input seconds cannot be submitted. No provider fallback is enabled.

Sources:
- https://www.alibabacloud.com/help/en/model-studio/wan3-0-video
- https://www.alibabacloud.com/help/en/model-studio/wan3-0-video-prime
- https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference
- https://docs.dev.runwayml.com/guides/pricing/

Database migration: video-pricing.sql. The database owns reservations, validates model/duration/resolution, snapshots cost and rate per generation, and keeps existing wallet locking and completion/refund behavior. Legacy callers use the project's resolution. Previously reserved jobs keep their original amount; customers are not retroactively charged.

Alibaba is disabled in private.video_provider_readiness and unavailable in the UI until configuration. Before enabling, set ALIBABA_API_KEY and ALIBABA_WORKSPACE_ID in Vercel for US Virginia, verify account model access and actual billing, then enable the Alibaba readiness row as the database owner and redeploy. Never enable based only on the presence of a key. The API also checks provider secrets before any reservation.

Other catalogue providers remain unavailable until their adapter and verified pricing are added. Complete Video/multi-scene pricing has not been changed; its costs require a separate pipeline quote.
