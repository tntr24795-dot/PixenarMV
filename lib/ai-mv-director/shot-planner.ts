/**
 * Deterministic first pass at a music-video shot plan.
 * Does not generate video, transcribe lyrics or claim lip sync.
 * The director can edit these shots before any credits are reserved.
 */
export type SongSection = { name: string; start: number; end: number };
export type PlannedMVShot = {
  position: number;
  title: string;
  startSeconds: number;
  durationSeconds: number;
  section: string;
  prompt: string;
};

export function planMusicVideoShots(
  sections: readonly SongSection[],
  songDurationSeconds: number,
  maxShotSeconds = 5,
): PlannedMVShot[] {
  if (!Number.isFinite(songDurationSeconds) || songDurationSeconds <= 0) {
    throw new Error('Invalid song duration');
  }
  if (!Number.isFinite(maxShotSeconds) || maxShotSeconds < 2 || maxShotSeconds > 30) {
    throw new Error('Shot length must be between 2 and 30 seconds');
  }
  const ordered = [...sections].sort((a, b) => a.start - b.start);
  const shots: PlannedMVShot[] = [];
  let cursor = 0;
  for (const section of ordered) {
    if (![section.start, section.end].every(Number.isFinite)) throw new Error('Invalid section time');
    if (section.start < cursor - 0.001 || section.end <= section.start || section.end > songDurationSeconds + 0.001) {
      throw new Error('Overlapping or out-of-range song sections');
    }
    if (section.start > cursor + 0.001) append('Instrumental', cursor, section.start);
    append(section.name || 'Music', section.start, section.end);
    cursor = section.end;
  }
  if (cursor < songDurationSeconds - 0.001) append('Outro', cursor, songDurationSeconds);
  if (!shots.length) append('Full song', 0, songDurationSeconds);
  return shots;

  function append(section: string, start: number, end: number) {
    const length = end - start;
    const count = Math.ceil(length / maxShotSeconds);
    for (let i = 0; i < count; i++) {
      const shotStart = start + (length * i) / count;
      const shotEnd = start + (length * (i + 1)) / count;
      shots.push({
        position: shots.length,
        title: `${section} · Shot ${i + 1}`,
        startSeconds: Number(shotStart.toFixed(3)),
        durationSeconds: Number((shotEnd - shotStart).toFixed(3)),
        section,
        prompt: `Create a cinematic music video shot for the ${section} section. Match the visual bible and character reference; keep continuity with adjacent shots.`,
      });
    }
  }
}
