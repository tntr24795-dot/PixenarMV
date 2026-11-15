/** MV quoting and storyboard editing primitives. No provider calls or credit debits here. */
export type MVQuoteInput = {
  durationSeconds: number;
  sceneSeconds: number;
  creditsPerScene: number;
  analysisCredits: number;
  storyboardCredits: number;
  exportCredits: number;
  retryReservePercent: number;
};
export type MVQuote = {
  sceneCount: number;
  generationCredits: number;
  reserveCredits: number;
  totalCredits: number;
  status: "estimate";
};
const valid = (n: number) => Number.isFinite(n) && n >= 0;
export function quoteMV(input: MVQuoteInput): MVQuote {
  const { durationSeconds, sceneSeconds, creditsPerScene, analysisCredits, storyboardCredits, exportCredits, retryReservePercent } = input;
  if (![durationSeconds, sceneSeconds, creditsPerScene, analysisCredits, storyboardCredits, exportCredits, retryReservePercent].every(valid) || durationSeconds <= 0 || sceneSeconds <= 0 || retryReservePercent > 100) {
    throw new Error("Invalid MV quote inputs");
  }
  const sceneCount = Math.ceil(durationSeconds / sceneSeconds);
  const generationCredits = sceneCount * creditsPerScene;
  const reserveCredits = Math.ceil(generationCredits * retryReservePercent / 100);
  return {
    sceneCount,
    generationCredits,
    reserveCredits,
    totalCredits: generationCredits + reserveCredits + analysisCredits + storyboardCredits + exportCredits,
    status: "estimate",
  };
}
export type StoryboardScene = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  description: string;
  prompt: string;
  locked: boolean;
};
export type StoryboardDraft = {
  revision: number;
  approved: boolean;
  scenes: StoryboardScene[];
};
export function updateStoryboardScene(draft: StoryboardDraft, id: string, patch: Partial<Pick<StoryboardScene, "description" | "prompt" | "locked">>): StoryboardDraft {
  if (draft.approved) throw new Error("Approved storyboard is immutable; create a new revision");
  const scene = draft.scenes.find(s => s.id === id);
  if (!scene) throw new Error("Scene not found");
  if (scene.locked && (patch.description !== undefined || patch.prompt !== undefined)) throw new Error("Scene locked");
  return { revision: draft.revision + 1, approved: false, scenes: draft.scenes.map(s => s.id === id ? { ...s, ...patch } : s) };
}
export function approveStoryboard(draft: StoryboardDraft): StoryboardDraft {
  if (!draft.scenes.length || draft.scenes.some(s => !s.prompt.trim() || s.endSeconds <= s.startSeconds)) throw new Error("Storyboard incomplete");
  return { ...draft, approved: true };
}
export function canGenerateMV(draft: StoryboardDraft, confirmedQuoteCredits: number, balanceCredits: number): boolean {
  return draft.approved && valid(confirmedQuoteCredits) && valid(balanceCredits) && balanceCredits >= confirmedQuoteCredits;
}
