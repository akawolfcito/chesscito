# UX feedback backlog — queued tactical items (2026-06-16)

Items the founder queued ("para la cola") while we worked other threads. Not
yet started. Captured here so nothing drops across the session.

## Trophies sheet polish (needs Sally pass)
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

## Share / preview cleanup
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
