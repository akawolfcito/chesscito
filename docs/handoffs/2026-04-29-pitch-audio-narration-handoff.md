# Handoff — pitch-audio-narration

**Date**: 2026-04-29
**Owner**: Wolfcito (@AKAwolfcito)
**Status**: script authored · audio pipeline deferred

## Context
The Chesscito pitch video (`ChesscitoPitch` A-Cut, 9 scenes, ~55s) currently renders silent. We scoped a bilingual ES/EN voiceover using a cloned voice of Wolfcito via ElevenLabs.

Decision (this session): write the narration text now; defer the full audio generation pipeline (ElevenLabs CLI, manifest, Remotion `<Audio>` integration) until later — no rush.

## What was done

- ✅ Spec drafted: `docs/superpowers/specs/2026-04-29-pitch-audio-narration-design.md`
- ✅ Adversarial review: `docs/superpowers/specs/2026-04-29-pitch-audio-narration-redteam.md`
  - Verdict: NEEDS REVISION (3 P0s + 7 P1s) — to address before implementation
- ✅ Narration script authored: `apps/video/src/lib/pitch-narration.ts`
  - 9 scenes × 2 locales = 18 entries
  - Text-only, no integration with composition yet
  - Tone: conversational, ~150 wpm ES / ~140 wpm EN, fits within current `durationFrames` with breath room

## What was NOT done (deferred)

- ❌ ElevenLabs voice cloning (Wolfcito sample upload to Voice Lab)
- ❌ `apps/video/.env` with `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID_WOLFCITO`
- ❌ CLI script `apps/video/scripts/generate-narration.ts`
- ❌ MP3 generation + manifest.json
- ❌ `<Audio>` integration in pitch scenes
- ❌ Dynamic `A_DURATION` recomputation in `Root.tsx` / `ChesscitoPitch.tsx`
- ❌ B-Cut Caregiver narration (out of scope — Spanish-only, Cibeira-bound)
- ❌ Legacy promo (`ChesscitPromo`) narration (out of scope)

## Decisions locked

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Voice: cloned Wolfcito (multilingual, single voice for ES + EN) | Brand identity continuity; ElevenLabs `eleven_multilingual_v2` supports bilingual cloned voice |
| 2 | Scope: A-Cut only | B-Cut tied to Cibeira citation in Spanish; no demand yet |
| 3 | Sync direction: audio drives scene timing | No live performer; narration shouldn't be rushed to fit fixed frames |
| 4 | Pipeline: manual CLI, MP3s committed | Determinism, no API key in CI, idempotent via SHA256 cache |
| 5 | No background music / SFX in v1 | Keep mix simple; voice-first |

## Next steps (when picking this up again)

### Phase 1 — Address red-team P0s (before any code)
1. Update spec: define `A_DURATION` recomputation strategy (per-locale Composition entries OR max-of-locales). See `redteam.md` finding P0 #1.
2. Update spec: add ToS consent acceptance criterion (cloned voice = Wolfcito's own).
3. Update spec: specify explicit dotenv path resolution (`apps/video/.env`, not project root).

### Phase 2 — Voice setup (off-repo, manual)
4. Record 1–3 min clean Wolfcito voice sample (no music/noise, mixed ES + EN if possible).
5. Upload to ElevenLabs Voice Lab → obtain `voice_id`.
6. Confirm ElevenLabs subscription tier supports cloned voice + `eleven_multilingual_v2` (Creator $22/mo recommended).

### Phase 3 — Implementation (TDD per `/tdd` skill)
7. Add `apps/video/.env` to `apps/video/.gitignore` (if not already).
8. Implement `apps/video/scripts/generate-narration.ts` per spec § Behavior.
9. Implement composition integration (manifest import, `<Audio>` in scenes, dynamic durations).
10. Pin `music-metadata` to exact version in `apps/video/package.json` (HARD RULE).
11. Run `pnpm --filter video generate:narration` → review MP3s in Studio.
12. Listen-through QA (ES + EN), iterate on `voice_settings` if needed.
13. Commit MP3s + manifest + integration code in granular commits.

## Open questions

- Does Wolfcito have an existing clean voice recording ≥1 min, or do we record fresh?
- Current ElevenLabs subscription tier?
- After listen-through, will EN scenes need separate `durationFrames` overrides (EN typically ~1.3× shorter than ES)?
- Audio fade-out at scene boundaries (6–10 frames) to prevent transition pops — do at MP3 generation time or in Remotion `<Audio volume>`? (P1 in red-team)

## Files touched this session

- `apps/video/src/lib/pitch-narration.ts` (new)
- `docs/superpowers/specs/2026-04-29-pitch-audio-narration-design.md` (new)
- `docs/superpowers/specs/2026-04-29-pitch-audio-narration-redteam.md` (new)
- `docs/handoffs/2026-04-29-pitch-audio-narration-handoff.md` (this file)

No code in `apps/video/src/Root.tsx`, scenes, or `pitch-copy.ts` was modified.

## Refs

- Pitch script (on-screen): `apps/video/src/lib/pitch-copy.ts`
- Pitch composition: `apps/video/src/ChesscitoPitch.tsx`
- Locale provider: `apps/video/src/lib/pitch-locale.tsx`
- Brand spec (v3.6): `docs/superpowers/specs/2026-04-28-pitch-brand-consolidation-v36.md`
- Pitch script v2 (editorial): `docs/superpowers/specs/2026-04-27-pitch-video-script.md`
