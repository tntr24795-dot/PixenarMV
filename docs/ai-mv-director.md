# PIXENAR STUDIO — AI MV Director

Status: implementation specification, not a functioning MV generator. Isolated development branch. Existing Create/Editor and production unchanged.

## Goal
Turn an uploaded song and performer/reference image into an editable full-length music video with synchronized cuts, character continuity, optional performance lip sync, scene-level regeneration, and final MP4 export.

## Reuse existing STUDIO foundations
- `app/create/page.tsx`: existing music-video mode.
- `components/create-studio.tsx`: music analysis sections, scenes, editable storyboard and model selection.
- `public.projects`, `public.scenes`, `public.generations`, `public.project_assets`, `public.exports`: preserve current schema and data.
- Current render queue, provider routing, credit reservation/refund and 1080p export must be verified rather than presumed working.

## Proposed pipeline
1. Validate owned/licensed MP3/WAV; upload privately; extract exact duration, waveform, beat/onset map and section boundaries.
2. Optional lyrics input or licensed transcription; forced-align words to audio to produce timecodes; handle instrumental sections.
3. Create editable treatment: narrative/performance/duet/abstract, visual bible, shot list and timing anchored to audio.
4. Generate approved reference character images and locked character IDs; define costume, location, lighting and continuity per scene.
5. Plan video clips matching provider duration constraints; generate scene assets asynchronously with model-specific credits and idempotency.
6. Optional lip sync only for vocal-performance scenes using a licensed provider capable of audio-driven facial animation; verify language support and duration limits.
7. Assemble original unmodified master audio with clips and transitions; use timeline timecodes rather than assuming each clip is exact duration.
8. Preview, selectively regenerate scenes, and export 16:9 / 9:16 at 720p / 1080p after entitlement and credit checks.

## UX
New entry: Music Video > AI MV Director (Auto) or Manual Studio.
Inputs: song, reference photo(s), optional lyrics, concept, style, aspect ratio, model and budget cap.
Review gates: audio analysis -> creative blueprint -> character references -> scene plan -> render -> full preview -> export.
Show per-scene status, estimated credit budget, timing and regeneration cost before execution.
Preserve existing split-panel editor and approved styling.

## Quality gates
- Test a 30-second owned song first, then 3–5 minutes.
- Beat cuts align with audio; chorus has intentional visual emphasis.
- Character identity and clothing continuity; lips align to sung phonemes where enabled.
- Failed clip retries do not double-charge; no missing segments or black frames; audio remains sample-accurate.
- Auth, RLS, private media access and subscription entitlements enforced server-side.
- Verify 1080p actually exports at 1920x1080 or 1080x1920.
- Do not claim Enkio's proprietary pipeline or models; this is independent implementation.

## Next implementation dependencies
Inspect current audio-analysis and render APIs; choose transcription/forced alignment and lip-sync providers based on verified API contracts, cost and commercial rights. No schema changes or production deployments until reviewed.
