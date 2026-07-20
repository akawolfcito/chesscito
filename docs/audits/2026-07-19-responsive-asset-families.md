# Responsive asset-family inventory — 2026-07-19

Generated reproducibly from decoded image metadata and normalized visual signatures.
Timestamps are not used as consistency evidence.

| Family | Slot(s) | Expected variants | State | Action |
|---|---|---|---|---|
| avatar-lite-hub | hub.avatar-lite | .png, .webp, .avif, -224w.webp, -224w.avif, -340w.webp, -340w.avif | healthy | none |
| avatar-pro | hub.avatar-lite | .png, .webp, .avif, -224w.webp, -224w.avif, -340w.webp, -340w.avif | healthy | none |
| shop/welcome-gift | shared.welcome-gift | .png, .webp, .avif, -96w.webp, -96w.avif, -128w.webp, -128w.avif, -160w.webp, -160w.avif | inconsistent-dimensions, unknown-source | approve-source |
| title-chesscito | brand.title | .png, .webp, .avif, -288w.webp, -288w.avif, -384w.webp, -384w.avif | healthy | none |

## Reproducible evidence

### /art/avatar-lite-hub

- Source dimensions: 499×560
- Normalized source signature: 362be641a65b3377653fd04f09d133b1b3395c8116b19bdb10c68f509f37ed5d
- Missing: none
- Orphan: none
- Normalized visual distances: /art/avatar-lite-hub.webp=6.49, /art/avatar-lite-hub.avif=0.32, /art/avatar-lite-hub-224w.webp=6, /art/avatar-lite-hub-224w.avif=0.6, /art/avatar-lite-hub-340w.webp=6.19, /art/avatar-lite-hub-340w.avif=0.44

### /art/avatar-pro

- Source dimensions: 499×560
- Normalized source signature: 269f2e6c765b95c3725e1785636ae3601ae94de34c08145bb1f114b18a995e10
- Missing: none
- Orphan: none
- Normalized visual distances: /art/avatar-pro.webp=6.26, /art/avatar-pro.avif=0.36, /art/avatar-pro-224w.webp=5.97, /art/avatar-pro-224w.avif=0.65, /art/avatar-pro-340w.webp=6.15, /art/avatar-pro-340w.avif=0.46

### /art/shop/welcome-gift

- Source dimensions: 120×122
- Normalized source signature: cdc883ebcc0a5134518e7b66b60da6ad0f21ffc1073b31c5a4ebe7d7121a7678
- Missing: none
- Orphan: none
- Normalized visual distances: /art/shop/welcome-gift.webp=5.9, /art/shop/welcome-gift.avif=1.46, /art/shop/welcome-gift-96w.webp=6.07, /art/shop/welcome-gift-96w.avif=3.98, /art/shop/welcome-gift-128w.webp=7.89, /art/shop/welcome-gift-128w.avif=6.93, /art/shop/welcome-gift-160w.webp=7.36, /art/shop/welcome-gift-160w.avif=4.83

### /art/title-chesscito

- Source dimensions: 512×249
- Normalized source signature: 7d19cfed144b3825e43837ccc52a3580ad1c97b0bfc49413d5cbddc2cb23346c
- Missing: none
- Orphan: none
- Normalized visual distances: /art/title-chesscito.webp=3.06, /art/title-chesscito.avif=0.32, /art/title-chesscito-288w.webp=2.53, /art/title-chesscito-288w.avif=1.36, /art/title-chesscito-384w.webp=3.07, /art/title-chesscito-384w.avif=1.03

## Selective action

- Regenerated: `/art/avatar-lite-hub`, `/art/avatar-pro`.
- Unchanged healthy: `/art/title-chesscito`.
- Unchanged pending approved source: `/art/shop/welcome-gift` (current canonical source is undersized/inconsistent).
