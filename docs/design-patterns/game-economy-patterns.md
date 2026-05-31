# Game Economy & Onboarding Patterns

> Institutional reference library. When designing any UX involving shop discoverability, retention loops, consumables, or FTUX, START here. Cite the pattern, then adapt to Chesscito.

**Maintained by:** Sally (UX) channel + Wolfcito
**Last updated:** 2026-05-31
**Convention:** new patterns are appended below; never reorder existing entries (cluster handoffs may link by anchor).

---

## How to use this doc

1. **Before designing a flow**, scan the table of contents for an established pattern. If one fits, name it explicitly in the proposal (e.g. "Pattern: Welcome Pack — see `game-economy-patterns.md#welcome-pack`").
2. **Adapt, don't reinvent**: patterns ship with anti-patterns to avoid. Read those before customizing.
3. **If no pattern fits**, propose a custom design AND propose adding it here as a new pattern (with the reference games that inspired it).
4. **Pull requests welcome**: link to the cluster handoff that surfaced the pattern in production.

---

## Table of contents

- [Welcome Pack](#welcome-pack)
- [Shield Rescue / Streak Protection](#shield-rescue--streak-protection)
- [Forcing Function for Catalog Awareness](#forcing-function-for-catalog-awareness)

---

## Welcome Pack

**Aliases:** Starter Bundle, Welcome Gift, New Player Pack
**Origin / reference games:** Clash Royale (Newbie Chest), Hearthstone (Welcome Bundle), Genshin Impact (Beginner's Wish), Duolingo (free Streak Freeze on day 1)
**Category:** FTUX · Shop discoverability · Activation

### Problem it solves

New users never visit the shop because:
- They have no currency
- They don't know what's for sale
- "Shop" mentally tags as "pay-to-skip", which most players avoid on first session

Without the first shop visit, every future SKU (cosmetics, save-packs, expansion content) dies on the vine — users don't even know it exists.

### The pattern

Pin a **free starter inventory tile** at the top of the shop. Tag it visually as a gift ("Welcome gift · solo para nuevos"). Make it claimable in **one tap**, with **zero cost** and **zero friction beyond a wallet/account connect**.

Contents should be:
- **Functionally useful** (not cosmetic-only) so the user feels mechanically rewarded
- **Single-job** (one SKU type, e.g. 3 shields) so the user learns one mechanic at a time
- **Modest in quantity** (3-5 of a consumable, not 50) so it does NOT devalue the paid SKU it advertises

### When it applies

- Any shop with future SKUs that need discoverability
- Any onboarding where first-shop-visit conversion is < 30%
- Any free-to-play loop where the user's mental model of "shop = paywall" needs disrupting

### When NOT to use

- Single-SKU shops (no discoverability problem to solve)
- Shops where every item is cosmetic + endgame (the welcome pack would feel disposable)

### Anti-patterns

- **Too generous**: a pack with 50 shields trains the user that consumables are free → kills the paid SKU
- **Too many SKUs**: a pack with shields + cosmetics + currency teaches nothing concrete; reduces to "free stuff" noise
- **Hidden in shop**: if the user has to scroll to find the welcome pack, you've failed the discoverability test
- **Time-gated claim** ("come back tomorrow to claim"): violates the moment-of-maximum-motivation principle
- **No deep-link from rescue moment**: forces user to manually navigate to shop, dropping conversion 50%+

### Anti-abuse

Welcome packs are by definition vulnerable to multi-claim abuse (new browser, new wallet, etc.). The defense layer depends on user identity model:

- **Wallet-based identity** (Chesscito, web3 games): server-side ledger keyed by wallet address. `INSERT ... ON CONFLICT (wallet_address) DO NOTHING`. Signature required to prove wallet control. Add IP-hash rate limit (Phase 2) to slow farms.
- **Account-based identity** (traditional F2P): keyed by account ID. Email verification adds defense.
- **No identity** (anonymous play): keyed by device fingerprint + IP. Accept marginal abuse — friction kills conversion more than abuse costs.

**Never** rely on localStorage alone — incognito mode trivially bypasses it. localStorage IS acceptable as a UI cache of "already claimed" for snappy rendering, but server is source of truth.

### Chesscito mapping

Implemented 2026-05-31 cluster (handoff `docs/handoffs/2026-05-31-shield-rescue-welcome-pack-handoff.md`, spec `_bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-pack-2026-05-31.md`). Pack contents: 3 shields. Identity: wallet address (server-side ledger). Deep-linked from fail-rescue modal at moment of maximum motivation.

---

## Shield Rescue / Streak Protection

**Aliases:** Streak Freeze (Duolingo), Streak Restore (Snapchat), Continue Token (arcade), Phoenix Down (RPGs)
**Origin / reference games:** Duolingo (Streak Freeze, Streak Repair), Snapchat (Streak Restore), Candy Crush (Lives), classic arcade (Continue?)
**Category:** Retention · Loss aversion · Consumable design

### Problem it solves

When user fails (loses streak, dies, mis-solves), the dominant emotion is frustration + sunk cost. If the failure is treated as terminal:

- Streak resets → loss-aversion kicks in → user often quits the session
- Required-progression mechanics lose their fun (every attempt feels punitive)
- Users who would happily pay $0.05 to NOT lose 30 days of streak are never offered the chance

### The pattern

A **consumable that protects what the user already has**. Critically, the consumable surfaces at the **rescue moment** (not in a passive HUD inventory).

```
Failure happens
   ↓
Brief "you failed" feedback (banner / animation)
   ↓
Rescue modal — appears in the SAME moment, no dead time
   ├─ User has rescue tokens: "Use 1 Shield to keep your streak" → primary CTA
   ├─ User has 0 tokens, never claimed welcome: "Claim 3 free shields" → deep-link to Shop
   └─ User has 0 tokens, past welcome: "Buy shields $0.025" → paid SKU
   ↓
Token used → streak intact + visible token count animates down
Skip / no-token → streak loses N units, board resets
```

### Why it works (psych)

- **Loss aversion** is ~2× as motivating as equivalent gain (Kahneman). Protecting an existing streak feels more valuable than earning a new one.
- **Sunk cost**: the user has already invested attempts. Offering rescue at the cliff edge is when willingness-to-spend (or willingness-to-claim) peaks.
- **Visibility at the rescue moment**: the consumable's existence is *contextual*, not encyclopedic. Users don't have to remember they have shields — the game reminds them when they're useful.

### When it applies

- Any progression mechanic with breakable continuity (streaks, levels, attempts, lives)
- Any loop where failure has a frustrating recovery cost (re-do level, re-grind, lose progress)
- Anywhere the user has a meaningful "thing they don't want to lose"

### When NOT to use

- Games with no persistent progression (each session is independent)
- Hardcore / roguelike games where loss is the core mechanic (rescue undermines the genre contract)

### Anti-patterns

- **Silent inventory**: shield as a number on a HUD chip the user never reads. If the rescue moment doesn't surface the shield, the shield doesn't exist in the user's mental model. ← *This was Chesscito's original design and the reason we needed this cluster.*
- **Auto-use**: removes consent, kills the meaningful choice that makes the token feel valuable
- **Punitive scarcity**: shields so expensive ($1+ each) that using one feels worse than losing the streak
- **Universal protection**: shield that prevents ANY failure trivializes the game. Limit by type (e.g. only protects streak, not score)
- **Hidden cooldown**: "you can only use 1 shield per day" without surfacing the cap → confusion + perceived bug

### Chesscito mapping

Implemented 2026-05-31 cluster alongside Welcome Pack. Shield = consumable that re-tries a failed exercise without losing the streak star. Surfaces in fail-rescue modal, NOT silently in HUD chip. HUD chip becomes long-press-tooltip + animation target on use.

---

## Forcing Function for Catalog Awareness

**Aliases:** Shop Gateway, Pinned First Visit, Catalog Onboarding
**Origin / reference games:** Effectively every F2P game (Clash Royale chest unlocks, Genshin first wish, Hearthstone first pack opening). The pattern is the meta-pattern: pair a Welcome Pack (above) with a forcing function (this one).
**Category:** Discoverability · Activation funnel · Habit formation

### Problem it solves

A high-motivation user moment (post-fail, post-win, daily login, milestone) is wasted if it doesn't drive the user to a surface they need to discover. Without a forcing function, users may never visit the shop, never see the daily quest panel, never read the patch notes, never check the leaderboard.

### The pattern

**Gate a high-motivation moment behind a brief shop / surface visit**, paired with a free or low-cost reward at the destination. The reward is the carrot; the moment is the stick.

```
High-motivation moment (e.g. first failure with 0 shields)
   ↓
Modal / banner: "Claim your free [thing] →" with deep link
   ↓
Lands user on the surface (shop, daily panel, badge wall, etc.)
   ↓
Surface shows: the free thing PROMINENTLY + the rest of the catalog as context
   ↓
User claims free thing, sees catalog peripherally, learns surface exists
```

### Why it works

- The user's emotional context (frustration, victory, curiosity) makes them ACT instead of dismiss
- The free reward eliminates the "is this a paywall?" resistance
- The catalog is seen in their peripheral vision *while* claiming the reward — passive learning
- Future visits are now self-initiated because the surface is in the mental model

### When it applies

- Any surface with low organic discoverability (shop, daily quest, badge wall, leaderboard)
- Any game with future SKUs / features that need awareness
- Any moment where the user is emotionally primed (post-fail = high willingness to rescue; post-win = high willingness to flex / share / collect)

### When NOT to use

- The destination surface is uninteresting or empty (forcing function creates a bad first impression)
- The user just visited the surface (forcing it again = annoyance, not discovery)
- The free reward is trivial or obviously useless (devalues the surface)

### Anti-patterns

- **Pure paywall**: forcing function with NO free path = adversarial UX, users feel tricked
- **Bait-and-switch**: free reward at destination is buried, requires scroll / sign-up / extra step. Reward must be one-tap at the landing surface.
- **Too frequent**: forcing function on every fail = nag. Use sparingly (first-encounter, milestones, weekly).
- **Decoupled from emotion**: forcing function in a low-emotion moment (e.g. on app boot) wastes the activation potential. Tie to actual user states.
- **No exit ramp**: modal that can't be dismissed without claiming → frustrates the small % who genuinely don't want the reward

### Chesscito mapping

Implemented 2026-05-31 cluster. Forcing moment: first failure with 0 shields. Free reward: Welcome Pack (3 shields). Destination: Shop, with Welcome Pack pinned at top. Subsequent first-fails (after claim or 3+ ignores) gracefully convert to paid SKU CTA — the forcing function gracefully degrades into a normal upsell after activation is achieved.
