# Red Team Review — pitch-audio-narration

**Date**: 2026-04-29
**Reviewer mindset**: hostile QA + senior engineer
**Subject**: `docs/superpowers/specs/2026-04-29-pitch-audio-narration-design.md`

## Findings

### P0 — Must address before implementation

- **[A_DURATION recomputation]** `apps/video/src/Root.tsx` declares `<Composition durationInFrames={A_DURATION}>` with `A_DURATION` computed at module load from `PITCH_A_COPY.scenes` (`ChesscitoPitch.tsx:24-27`). Spec says scene durations come from manifest dynamically per-locale, but Remotion `<Composition durationInFrames>` is a single static number per composition entry. If narration extends scenes, the composition will truncate the video. — **Why blocking**: video would cut off mid-narration. Spec must define exactly how `A_DURATION` is computed (e.g., compute manifest-aware duration for both locales at module load, take max, expose as constant) OR register two Composition entries (`ChesscitoPitchEs`, `ChesscitoPitchEn`) with locale-specific durations.

- **[Voice cloning ToS]** ElevenLabs Terms of Service explicitly require consent from the voice owner. Spec mentions this in passing (Behavior #1) but does not put it in Acceptance Criteria. — **Why blocking**: ToS violation = account ban + brand risk. Add acceptance criterion: "ToS consent note in `generate-narration.ts` header comment AND `pitch-narration.ts` references the cloned voice as Wolfcito's own only."

- **[Env path mismatch with monorepo]** Spec says `apps/video/.env`. Need to verify whether `dotenv` is invoked from `apps/video/` (cwd) when running via `pnpm --filter video generate:narration`. Turborepo + pnpm filter set cwd correctly, but the script must explicitly load `apps/video/.env` (not project root `.env`). — **Why blocking**: secrets could leak to wrong .env file or fail to load. Spec must specify `dotenv.config({ path: path.resolve(__dirname, "../.env") })` or equivalent.

### P1 — Should address

- **[Per-locale duration coupling in single Composition]** Spec Behavior #6 says "max of both locales" — but means EN renders carry trailing silence equal to (ES_duration − EN_duration). At 9 scenes that could be 5–15s of dead air in EN cut. Consider: separate Compositions per locale (cleaner, larger Studio panel) OR per-scene `<Sequence>` with per-locale `durationInFrames` (preserves single Composition entry).

- **[Cost ceiling unstated]** No budget guardrail in spec. ElevenLabs multilingual_v2 ≈ $0.30/1k chars. 18 scenes × ~200 chars ≈ 3.6k chars per full regen ≈ $1.10. With voice cloning, multiplier may apply. Worst case: dev runs `--force` 50× = $55. **Risk if ignored**: surprise bill. Mitigation: CLI prints `Estimated cost: ~$X.XX` from char count before making calls; require `--yes` to skip prompt in CI/headless.

- **[ffprobe vs music-metadata]** Spec switched to `music-metadata` (Node-native) — good, but doesn't pin the version. Not in `apps/video/package.json` yet. **Risk**: install drift, MP3 duration mis-read for VBR encodings. Mitigation: pin exact version in spec (e.g., `music-metadata@10.7.4`) per repo convention (HARD RULE — exact version pins).

- **[Manifest as static import vs runtime fetch]** Spec says `import manifest from "../public/audio/pitch/manifest.json"` at module load. Remotion bundles JSON imports into the bundle. Pros: fast, no I/O. Cons: bundle re-builds on every manifest change; in Studio, hot-reload may serve stale data. Validate Remotion HMR behavior or use `staticFile("/audio/pitch/manifest.json")` + `useEffect(fetch)`.

- **[Locale text length disparity]** ES is typically 1.2–1.4× longer than EN for the same content. Spec stores per-locale durationFrames in manifest — good. But `getSceneDurationFrames` returns a single number per (scene, locale). Confirm scene components actually pass `locale` to read the right entry; otherwise EN render uses ES durations.

- **[Audio cut on scene fade transition]** `ChesscitoPitch.tsx:42-44` uses `<TransitionSeries.Transition presentation={fade()}>` — the visual fade is 15 frames (0.5s). Audio inside `<TransitionSeries.Sequence>` will hard-cut at sequence boundaries. **Risk**: pop/click between scenes. Mitigation: add 6–10 frames of audio fade-out in CLI (post-process MP3 with `ffmpeg -af afade`) OR use Remotion `<Audio volume={interpolate(...)}/>`.

- **[Atomic manifest write race]** Spec says "write to temp, rename" — good. But doesn't mention what happens if CLI is killed mid-batch (Ctrl-C). Half-written MP3s + stale manifest = corruption. Mitigation: write manifest entry only AFTER successful MP3 write + duration measurement; on SIGINT, flush partial manifest.

### P2 — Nice to clarify

- **[Tail padding hardcoded]** `tailPaddingFrames: 12` (0.4s @ 30fps). Hardcoded in manifest type. May want per-scene override (e.g., `cta` scene needs longer breathe room). Defer to v2.

- **[Voice settings hardcoded]** `stability=0.5, similarity_boost=0.85` baked into CLI. If listen-through reveals issues, re-tuning means code change + commit. Consider exposing via `pitch-narration.ts` per-scene if needed.

- **[Studio preview cost]** Every Studio re-mount could trigger fresh `<Audio>` HTTP fetches. Acceptable but worth noting; static files served from `public/` are cheap.

- **[Stereo / sample rate]** ElevenLabs returns mono 44.1kHz MP3. Remotion handles fine. No action.

- **[Subtitle export future]** Manifest has timing data — easy to derive SRT later. Spec correctly defers.

- **[Manifest schema versioning]** No `schemaVersion` field. If manifest format evolves, old MP3s become unreadable to new code without migration. Add `"schemaVersion": 1` for forward compat.

## Categories audited

### Contract gaps
- `NarrationManifestEntry` lacks `schemaVersion` field at root → P2
- No error type for partial generation failures (CLI just exits non-zero) → acceptable for CLI tool
- `getSceneAudioSrc` returns `string | null` — caller must handle null. Spec ✓.
- `tailPaddingFrames` typed as literal `12` — too rigid for future tuning → P2

### Behavioral ambiguity
- "Graceful degradation if manifest missing" — does it `console.warn` once, or once per scene component mount? Spec says "warn-once" — good but implementation must guard against React StrictMode double-invoke.
- Behavior #4: "Updates manifest.json" — atomic write specified, but ordering with MP3 file write not specified. Resolved in P1 finding above.

### Hidden assumptions
- `pnpm --filter video generate:narration` sets cwd correctly → verified by Turborepo convention but worth a guard
- Wolfcito has clean voice samples → flagged in Open Questions ✓
- ElevenLabs subscription tier → flagged in Open Questions ✓
- Network access during CLI run (no mention of offline fallback)

### Backward compatibility
- Adding `<Audio>` to scenes does not break renders without manifest (graceful degradation) ✓
- `A_DURATION` change may break anyone hardcoding frame counts → low risk, internal usage only
- Existing `ChesscitoPitch16x9` composition (Root.tsx:60+) inherits same `A_DURATION` — must verify it picks up dynamic value

### Security & data
- ✓ `.env` in `.gitignore` (must verify before commit per CLAUDE.md hard rule)
- ✓ Voice samples not committed (biometric PII)
- ✓ CLI does not log API key
- ⚠️ ElevenLabs `request_id` stored in manifest — confirm this is not sensitive (it isn't, per ElevenLabs docs, but verify)
- ⚠️ MP3 files committed to repo — Wolfcito's voice IS biometric data. Acceptable since user is voice owner, but note in spec that this repo is private/public-aware.

### Test coverage gaps
- No unit test for `getSceneDurationFrames` fallback logic
- No test for graceful degradation when manifest missing
- No CI test (acceptable: CLI runs manually only, no API key in CI)
- Manual acceptance: render preview + listen-through. Spec should add "manual QA checklist" with: ES playback, EN playback, no clipping, no pops between scenes.

### Operational readiness
- Rollback: `git revert` of MP3 commit + delete `public/audio/pitch/`. Reversible ✓
- Logging: spec says "scene-by-scene status with timing" — good
- Cost observability: missing → P1 finding
- Idempotency: hash-based cache → ✓

## Verdict

**NEEDS REVISION** — 3 P0s + 7 P1s to address:

### P0 actions
1. Spec Behavior #6: define `A_DURATION` recomputation strategy explicitly (per-locale Composition entries OR max-of-locales constant computed at module load).
2. Acceptance criteria: add ToS consent note requirement for `generate-narration.ts` header.
3. Spec Behavior #2: specify explicit dotenv path resolution (`apps/video/.env`) so monorepo cwd doesn't pick up wrong file.

### P1 actions (recommended before /tdd, not strictly blocking)
1. Add cost-estimate prompt to CLI (`Estimated: ~$X.XX, continue?`)
2. Pin `music-metadata` to exact version in spec
3. Decide manifest import strategy (static import vs `staticFile + fetch`) — pick one
4. Add audio fade-out (6–10 frames) at MP3 generation time to prevent transition pops
5. Specify SIGINT-safe ordering (MP3 first, then manifest entry)
6. Add `schemaVersion: 1` to manifest root
7. Confirm `ChesscitoPitch16x9` Composition picks up dynamic `A_DURATION`

Once P0s landed, ready for `/tdd`. P1/P2s can be tracked as follow-ups but several (cost prompt, fade-out) are cheap to bake in now.
