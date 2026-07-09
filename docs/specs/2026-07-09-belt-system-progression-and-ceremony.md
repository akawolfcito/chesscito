# Chesscito Belt System — Progression, Rank & Ceremony

> Core design document. Supersedes the "rewards for consistency" framing.
> Author: Samus Shepard (Game Designer) with Wolfcito, 2026-07-09.
>
> **Status: ACCEPTED — NOT IMPLEMENTED, NOT SCHEDULED.**
> Nothing here has shipped and nothing here gets built until the MiniPay delivery,
> the landing slides and the existing flows are closed. This is the spine future work
> is measured against, not a backlog item. Do not open this surface early.
>
> The one exception with a clock on it is Decision 2's threshold — see the timing note.

---

## The sentence everything hangs from

> **Consistency earns you the right to be examined. Mastery earns you the rank.**

Borrowed from the dojo, where attendance never granted a belt — it granted the right
to grade for one. Both are required. Neither substitutes for the other.

## Pillars

1. **Chesscito does not pay people to play. It graduates habits and mastery.**
2. **Chesscito never sells the probability of a reward.** The Pass sells commitment,
   experience and support for learning.
3. **Shields are humanity, not advantage.** They protect the process; they can never
   touch a grade.
4. **Money never touches the belt.** Nobody buys a black belt.
5. **What the client reports is a wish. What the chain timestamps is a fact.**
   Anything consequential hangs from facts.

## The five layers

| Layer | Means | Lives in |
|---|---|---|
| **Attendance** | I trained, I came back | Days trained, daily proof tx |
| **Practice** | I solved with quality | Stars per exercise |
| **Examination** | I demonstrated mastery of a piece | Piece badge (on-chain) |
| **Rank** | Who I am in Chesscito today | Single visible title, derived from badges |
| **Ceremony** | Others saw it; I changed | Meetup, virtual or in person |

Pieces are exams. Badges are exams passed. **Rank is identity.** The meetup is where
identity is conferred.

---

## What already exists (verified in code, 2026-07-09)

The belt ladder is **already live** and unnamed. `badge-sheet.tsx`:

```ts
function isPieceUnlocked(index) {
  if (index === 0) return true;                     // rook, always
  if (badgesClaimed[PIECES[index]]) return true;
  return Boolean(badgesClaimed[PIECES[index - 1]]); // previous piece claimed
}
```

You cannot train the bishop until you claim the rook's badge.
`rook → bishop → knight → pawn → queen → king` is an ordered belt progression, shipped,
currently presented as a shelf of trophies.

What is missing is the thing that makes a belt a belt: **a single, present-tense identity.**
Today the player *has* six objects. A belt is something the player *is*.

---

## Decision 1 — Rank is one visible title, derived from piece badges

- Six badges → one rank. Displayed on profile, hub, leaderboard, certificate, meetup.
- **Derived from on-chain badge ownership** (`Badges` contract), so rank is verifiable
  without trusting our server. This sidesteps the trust problem that undermines every
  score-based reward: the server signs any score a client sends, but it cannot fake a
  badge the chain does not hold.
- **HARD RULE: no purchasable artifact may feed rank.** The Founder Badge is a Shop SKU
  (`FOUNDER_BADGE_ITEM_ID = 1n`). It must never count. If rank counts badges, and a badge
  can be bought, rank can be bought.

Naming is open. Sketch, not final: Aprendiz → Explorador → Guardián → Táctico → Estratega
→ Maestro Chesscito.

## Decision 2 — Mastery thresholds are proportional, never absolute

Today: `BADGE_THRESHOLD = 10` stars, absolute. Rook maxes at 30 stars, so the badge lands
at **33% mastery**. At the roadmap's 100 exercises per piece (300 stars) the same constant
grants the badge at **3.3%**.

**The belt gets cheaper every time we write content.** This is the same defect class as the
`/api/sign-score` cap that broke on-chain saves this week: an absolute number bolted to a
growing catalog. It must be a fraction of achievable mastery.

Founder's calibration:

| Level | Feels like | Fraction |
|---|---|---|
| Participation | I tried it | a minimal path |
| Basic competence | I understand the piece | 40–50% |
| Solid command | I solve it well | 70–80% |
| Mastery | I solve it with quality | 85–90%+ |

> The first reward should arrive early. **The rank must be earned. Mastery must be respected.**

**Open tension to resolve before implementing:** the founder wants an early motivating
reward *and* wants the badge to be a real exam. Those are different artifacts. Either
(a) raise the badge to exam territory (70–80%) and let existing early-game beats — stars,
streak, the day's gift — carry the early motivation, or (b) keep the badge cheap and mint a
separate graduation artifact per piece. **Recommendation: (a).** One exam per piece. A second
collectible dilutes the ceremony and doubles the surface area.

**Timing matters.** Raising the threshold is nearly free today — almost no badges are minted,
production is a founder-only snapshot. Once hundreds exist under the old meaning, changing it
either invalidates them or forks the meaning of an NFT we cannot un-mint. **This is a
now-or-expensive decision, exactly like the score ceiling.**

## Decision 3 — Attendance is cumulative, not consecutive

This is the load-bearing correction, and it is not cosmetic.

If attendance gates examination, and shields protect attendance, and shields come with the
paid Pass, then **paying protects your path to rank.** Milder than paying for money, same
shape. The founder explicitly does not want this.

The root cause is not shields. **A consecutive streak is fragile by design; everything fragile
needs protection; every protection can be sold.**

So do not make it fragile. Count **days trained**, cumulative. Twenty-one days of dojo
qualify you to grade, consecutive or not. Missing a Tuesday costs nothing. There is nothing to
protect, therefore nothing to sell. The daily streak survives as a personal flourish with zero
economic weight, and the Shield stays where it already lives in code: protecting the exercise
COMBO inside LEARN.

**Note:** the founder's mental model ("a shield saves the day so I can checkpoint and continue")
describes Daily Streak recovery, which does not exist. `docs/backlog/2026-07-08-tactical-day-gift-proof-of-consistency-lote-2.5.md`
states plainly: *"El Shield actual protege el Exercise COMBO, NO el Daily Streak. NO implementar
Daily Streak recovery ahora."* Under this design, **it should never be built.**

## Decision 4 — Rank is conferred, not computed

A rank that appears the millisecond you cross a threshold is a toast notification, not a
graduation. Ceremony needs anticipation, a cohort, and witnesses.

But gating progression on live attendance excludes the very people this is for: other time
zones, children with school hours, adults with shifts. So split them:

- **Graduation** — asynchronous, available to everyone who qualifies. You are named, the rank
  changes, the proof lands on-chain.
- **The live ceremony** — the emotional peak, virtual or in person, optional. Where you are
  named in front of others.

> A class teaches. A dojo accompanies. **A ceremony transforms.**

The ceremony also happens to be the strongest anti-fraud device in the system. A cheater can
forge any score. **A cheater cannot show up.**

## Decision 5 — What money is, and is not

Money is not the product and never the promise. If it appears:

- To **activate a campaign**: small, bounded, sponsored, transparent rules.
- To **return value to the community**: recognition of healthy participation, never a promised
  return.
- **Never** to sell a chance at winning.

Sustaining the project comes from Season Pass, PRO, Coach, Peones — experience and support,
not lottery tickets. And any monetary reward must hang from **verifiable facts**: on-chain
proofs, days completed, transparent auditable rules. Never from client-reported signals.

**Explicitly rejected: "who solved fastest".** `timeMs` is client-reported and the server signs
it unverified. It is continuous, so lying a little wins, and lying is trivial.

**The one-time asset.** A reward that is not announced upfront is a gift, not a wager — which
is what keeps this out of casino territory. But surprise works once. By season 3 the rules are
folk knowledge and every incentive we designed against returns. **Design for season 3.**

---

## What this changes

**Before**

```
21-Day Challenge → streak → shields → possible rewards → looks like a prize draw
```

**After**

```
21-Day Training Cycle → attendance + practice → right to be examined
  → mastery per piece → badge → rank → ceremony → proof
  → optional, secondary recognition
```

## Consequences for existing systems

- **Season Pass** sells commitment, experience, content, cosmetics. Never eligibility.
- **Shields** protect the exercise COMBO. They never touch attendance, examination or rank.
- **21-Day Challenge** becomes a training cycle, not a competition.
- **Badges** become exams. Threshold moves to a fraction of mastery.
- **Leaderboard** stops ranking accumulated mastery, which is a collection stat and rewards
  having arrived early. What it ranks instead is an open question (below).
- **On-chain** stores what must be trusted: badges (exam passed), daily proofs (attendance).

## Non-goals

- Daily Streak recovery. Do not build it.
- A purchasable path to rank, in any form.
- A monetary prize as the emotional centre of the challenge.
- Ranking by absolute accumulated mastery.

## Founder decisions (Wolfcito, 2026-07-09)

Accepted as the conceptual base. None of it is scheduled.

1. Cumulative consistency is the base of the 21-Day **Training Cycle**.
2. Shields stay on the exercise COMBO. No Daily Streak recovery — ever, under this design.
3. Badge = a serious exam. Early rewards must come from somewhere else.
4. `BADGE_THRESHOLD` must become proportional **before many badges are minted**.
5. Rank is a single visible identity.
6. Graduation is asynchronous; the live ceremony is the emotional peak, never a gate.
7. Revisit whether a leaderboard is needed at all, or a vitrine of cohorts instead.
8. Money touches nothing: not rank, not Shields, not client-reported signals, not the
   probability of a reward.

## Open questions — founder's initial answers

Settled enough to build on; revisit when the work is actually scheduled.

1. **Rank naming and count** — few ranks to start, likely 4–6. The six badges feed **one**
   visible identity, not six separate ones.
2. **The early-reward artifact** — no second NFT per piece. The badge is the exam; early
   rewards are visual and local (stars, daily gift, visible progress, small celebrations,
   unlocks).
3. **Leaderboard** — pause the classic accumulated-mastery board. Explore a vitrine of
   cohorts, ranks and graduations instead. If a ranking exists, it recognises; it never
   rewards, and it must not be farmable.
4. **Regional grouping** — belonging, never a prize bracket.
5. **Cohort cadence** — monthly or per season; something that feels natural against 21 days.
6. **Attendance requirement** — yes, require a minimum **cumulative** attendance to sit the
   exam. Never consecutive, never fragile.

## Next step

A GDD tying this to the rest of the game, **after** MiniPay closes. Until then this document
is accepted design, not work.

## Implementation notes (not a plan)

- `BADGE_THRESHOLD` (`lib/game/exercises.ts:28`) → a fraction of `getMaxPossibleStars(piece)`.
- Rank derivation reads the `Badges` contract, excluding `FOUNDER_BADGE_ITEM_ID`.
- "Days trained" needs a home. Attendance is currently `chesscito:daily-progress` on the device;
  a cumulative counter that money or rank depends on cannot live only in `localStorage`.
- The proof-of-consistency tx already gives timestamped, unforgeable attendance. Use it.
