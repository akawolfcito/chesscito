# Spec — pitch-audio-narration

**Date**: 2026-04-29
**Status**: draft

## Problem
The Chesscito pitch video (`ChesscitoPitch` composition in `apps/video`) currently renders silent. We need a narrated voiceover so the video can be shared standalone (no live presenter). Constraints: bilingual (ES + EN), must preserve Wolfcito's voice identity for brand consistency, deterministic output (committable to repo), no API access in CI.

## Goal
`ChesscitoPitch` renders end-to-end with narrated voiceover in ES and EN using a cloned voice of Wolfcito, generated via a manual ElevenLabs CLI script that produces deterministic, cached MP3 assets.

## Non-goals
- B-Cut Caregiver (`ChesscitoPitchCaregiver`) narration
- Legacy promo (`ChesscitPromo`) narration
- Background music / SFX
- Live narration / real-time TTS at render time
- Multiple voices / character dialogue
- Lip-sync or character mouth animation
- Burned-in subtitles (existing on-screen text overlays already serve this)
- CI-side audio generation (manual only — API key never enters CI)

## Contracts (SDD)

```ts
// apps/video/src/lib/pitch-narration.ts

import type { PitchLocale } from "./pitch-copy";

export type SceneId =
  | "hook"
  | "problem"
  | "capabilityShow"
  | "solution"
  | "coachVO"
  | "arena"
  | "sovereignty"
  | "teamMini"
  | "cta";

/** Authored narration text per scene per locale. */
export interface SceneNarrationScript {
  sceneId: SceneId;
  text: Record<PitchLocale, string>;
}

export const PITCH_NARRATION_SCRIPT: readonly SceneNarrationScript[];
```

```ts
// apps/video/src/lib/pitch-narration-manifest.ts

export interface NarrationManifestEntry {
  sceneId: SceneId;
  locale: PitchLocale;
  /** Path relative to apps/video/public, e.g. "/audio/pitch/hook.es.mp3" */
  audioPath: string;
  /** Measured from rendered MP3 via ffprobe / music-metadata. */
  durationMs: number;
  /** ceil(durationMs/1000 * 30) + tailPaddingFrames. */
  durationFrames: number;
  /** sha256("voiceId|modelId|text") — cache key. */
  contentHash: string;
  /** ElevenLabs request_id for forensics. */
  requestId: string;
}

export interface NarrationManifest {
  generatedAt: string; // ISO 8601
  voiceId: string;
  modelId: "eleven_multilingual_v2";
  /** Frames added after audio ends so video doesn't cut on silence. */
  tailPaddingFrames: 12;
  scenes: NarrationManifestEntry[];
}
```

```ts
// Helper consumed by ChesscitoPitch.tsx and scene components.
export function getSceneDurationFrames(
  sceneId: SceneId,
  locale: PitchLocale,
  manifest: NarrationManifest | null,
  fallbackFrames: number
): number;

export function getSceneAudioSrc(
  sceneId: SceneId,
  locale: PitchLocale,
  manifest: NarrationManifest | null
): string | null;
```

## Behavior

1. **Voice cloning consent (one-time, off-repo)**: developer (Wolfcito) records 1–3 min of clean speech, uploads to ElevenLabs Voice Lab. ElevenLabs ToS requires explicit consent for any cloned voice — only Wolfcito's own voice is permitted. Voice samples are biometric PII and MUST NOT be committed to the repo.

2. **Env config**: `apps/video/.env` (gitignored) holds `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID_WOLFCITO`. The CLI exits with a clear error if either is missing before making any API call.

3. **Authoring**: narration text per (sceneId, locale) lives in a new file `apps/video/src/lib/pitch-narration.ts`. Separate from `pitch-copy.ts` because spoken narration may differ in tone, length, and pacing from on-screen text overlays.

4. **Generation CLI** — `apps/video/scripts/generate-narration.ts`, runnable as `pnpm --filter video generate:narration`:
   - Reads `PITCH_NARRATION_SCRIPT` and existing `manifest.json`
   - For each `(sceneId, locale)` pair: computes `contentHash = sha256(voiceId|modelId|text)`
   - If `contentHash` matches existing manifest entry → SKIP (cached)
   - Otherwise calls ElevenLabs `POST /v1/text-to-speech/{voice_id}` with:
     - `model_id: "eleven_multilingual_v2"`
     - `voice_settings: { stability: 0.5, similarity_boost: 0.85 }`
     - body: text
   - Writes MP3 to `apps/video/public/audio/pitch/<sceneId>.<locale>.mp3`
   - Measures duration with `music-metadata` (Node-native, no system ffprobe dep)
   - Captures `request_id` from response headers
   - Updates `manifest.json` entry
   - Final manifest written atomically (write to temp, rename)
   - Flags: `--force` (regen all), `--dry-run` (print plan, no network calls), `--scene <id>` (single scene)

5. **Composition integration**:
   - `ChesscitoPitch.tsx` imports manifest at module level (`import manifest from "../public/audio/pitch/manifest.json"`)
   - Each scene component receives `audioSrc` + `durationFrames` via props OR reads via `useContext` from `PitchLocaleProvider` (already exists)
   - Each scene renders `<Audio src={staticFile(audioSrc)} />` from `remotion`
   - If manifest is `null` (file missing) → no `<Audio>` tag rendered → silent video (graceful degradation, console.warn once)

6. **Dynamic scene durations**: each scene's effective `durationFrames` = `Math.max(authoredDurationFrames, narrationDurationFrames + tailPaddingFrames)`. Per-locale: ES and EN may have different effective durations. `A_DURATION` is recomputed dynamically per-locale at render time from the manifest, not hardcoded from `pitch-copy.ts`. Root composition declares `durationInFrames` using a "max of both locales" calculation so a single Composition entry serves both renders.

7. **Locale switching**: at render time, `locale` prop drives which `audioPath` is selected from the manifest. No runtime API calls. No re-encoding.

8. **Run flow**:
   - Author/edit `pitch-narration.ts`
   - Run `pnpm --filter video generate:narration` locally
   - Review generated MP3s in Remotion Studio
   - Commit: `pitch-narration.ts`, `manifest.json`, generated `.mp3` files

## Edge cases

- **Missing API key / voice ID** → CLI exits with `Error: ELEVENLABS_API_KEY missing in apps/video/.env` before any network call. No partial state.
- **ElevenLabs API failure mid-batch** → CLI logs the failed scene with status code, leaves prior scenes' MP3s + manifest entries intact, exits non-zero. Re-run picks up where it left off.
- **Rate limit (429)** → CLI honors `Retry-After` header; max 3 retries with exponential backoff; then fails the scene.
- **Manifest missing entirely** → composition warns once, renders silent video. Build does not fail.
- **Scene authored duration > narration duration** → keep authored duration (visual pacing wins).
- **Narration duration > authored duration** → extend scene to fit narration + tail padding.
- **EN narration much shorter than ES** → per-locale `durationFrames` differ; both stored in manifest; composition picks correct one at render.
- **`.mp3` file present but missing from manifest** → orphaned, ignored at render time. CLI `--prune` flag (future) can clean up.
- **Voice sample drift** (ElevenLabs model updates): manifest stores `requestId` for forensics; if voice changes audibly between renders, force-regen all entries.
- **Hash collision** (vanishingly unlikely with sha256) → accepted risk.

## Acceptance criteria

- [ ] `apps/video/src/lib/pitch-narration.ts` exports `PITCH_NARRATION_SCRIPT` covering 9 scenes × 2 locales = 18 text entries
- [ ] `pnpm --filter video generate:narration` produces 18 MP3s under `apps/video/public/audio/pitch/`
- [ ] `manifest.json` lists all 18 entries with valid `contentHash`, `durationMs`, `requestId`
- [ ] Re-running CLI with no source changes triggers 0 API calls (full cache hit)
- [ ] `--force` regenerates all 18 entries
- [ ] `--dry-run` prints plan without making API calls
- [ ] `--scene hook` regenerates only `hook.es.mp3` + `hook.en.mp3`
- [ ] `ChesscitoPitch` rendered with `locale="es"` plays Spanish narration in sync
- [ ] `ChesscitoPitch` rendered with `locale="en"` plays English narration in sync
- [ ] No scene visually ends before its audio finishes (audio is never clipped mid-word)
- [ ] Deleting `manifest.json` does not break render (silent fallback, warn-once log)
- [ ] `apps/video/.env` is gitignored; `git status` shows it untracked after env vars added
- [ ] No `console.log` of API key or voice ID in CLI output, even on error
- [ ] Voice cloning ToS consent note documented in `apps/video/scripts/generate-narration.ts` header comment

## Out of scope / future
- B-Cut Caregiver narration (separate spec when needed)
- Background music bed
- Sound effects (whoosh on transitions, ding on logros)
- Crossfade between scenes' audio
- Multi-language beyond ES/EN (PT, FR, etc.)
- Real-time TTS preview in Studio
- CI-side regeneration / automated PRs on script changes
- Subtitle file (SRT/VTT) export from manifest
- `--prune` flag to clean orphaned MP3s

## Open questions
- ElevenLabs subscription tier for cloned voice + `eleven_multilingual_v2`: Creator ($22/mo) confirmed sufficient; Starter ($5/mo) does NOT include cloning. → user to confirm tier active.
- Source of Wolfcito voice samples: any existing clean recording (≥1 min, no music/noise)? If not, record fresh sample before voice lab upload.
- `voice_settings` tuning: defaults `stability=0.5`, `similarity_boost=0.85`. May need tuning after first render listen-through; not blocking spec.
