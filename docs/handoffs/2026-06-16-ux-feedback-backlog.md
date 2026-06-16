# UX feedback backlog — queued tactical items (2026-06-16)

Items the founder queued ("para la cola") while we worked other threads.

**STATUS 2026-06-16: both clusters DONE.**
- Trophies polish: `ec0275f7` (hide COMING LATER + cream MY VICTORIES),
  `63450fe7` (achievements 2-col grid + thematic icons).
- Share/preview: `285236bb` (de-dupe link + hide Download in MiniPay),
  `8c319252` (candy home OG via Satori).
- Open follow-up: normalize share URLs to `www.chesscito.com` (apex `chesscito.com`
  still used in `editorial.ts:388/401/1970`) — NOT changed (founder confirm; the
  recalled www rule may be stale, verify the domain is set up before flipping).

## Trophies sheet polish (needs Sally pass) — ✅ DONE
Founder screenshots reviewed 2026-06-16.
1. **Hide the "COMING LATER" zone** (Tournaments / VIP Passes / Seasonal
   Rewards faded rows). Show what exists, don't promise. — clear, low-risk.
2. **MY TROPHIES empty state: tone down the gold.** The whole empty-state card
   is a solid gold/amber block for a single ARENA CTA ("the dorado for 1
   button"). Lighten to cream like the other panels; keep the green ARENA
   button as the only saturated element.
3. **ACHIEVEMENTS: not "wow".** Today = tall full-width cards each with a giant
   centered lock. Direction (Sally): compact badge grid — dimmed silhouette +
   progress ring for locked, full color + glow for earned. Founder may still
   send a reference image.

## Share / preview cleanup — ✅ DONE
Founder feedback 2026-06-16.
1. **Share output inconsistent** — sometimes an image, sometimes a link; some
   shared links look DUPLICATED, sometimes a normal single link. Investigate
   WHY and under WHICH conditions (which surfaces/handlers, navigator.share vs
   clipboard, OG vs plain URL). Then make it consistent.
2. **chesito.com OG/share preview is stale** — still shows the OLD (v1)
   chesito art, not the new candy tones. Update the share/OG preview so a
   shared link looks like the current game. (Check apex `chesito.com` vs
   `www.chesscito.com` per the share-previews rule; IG/TikTok strip OG.)
3. **MiniPay: hide the Download button.** In MiniPay, tapping Download opens
   the image inside MiniPay and it renders deformed. We can't change that
   in-app viewer behavior, so HIDE the Download button when running inside
   MiniPay (detect MiniPay context). Keep it elsewhere.

## Spacing follow-up (optional)
- Dock icon+text is now consistent with the action-pins after `e0461211`. If
  the founder still wants the DOCK label looser (it sits ~2px under the icon),
  that needs a dock-height tweak + a VR baseline refresh — deferred unless asked.

## Notes
- All "done" work this session is committed on `main` (local, not pushed).
- Active thread: Exercises/Labyrinths content pipeline brainstorm (spec in
  progress).
