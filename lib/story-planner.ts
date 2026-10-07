export type PlannedCharacter = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  wardrobe: string;
  voice: string;
};

export type PlannedDialogue = {
  characterId: string;
  text: string;
  delivery: string;
};

export type PlannedScene = {
  title: string;
  summary: string;
  visualPrompt: string;
  cameraDirection: string;
  location: string;
  timeOfDay: string;
  characterIds: string[];
  dialogue: PlannedDialogue[];
  continuityNotes: string[];
  durationSeconds: number;
};

export type StoryPlan = {
  source: "ai-gateway" | "deterministic-fallback";
  title: string;
  logline: string;
  characters: PlannedCharacter[];
  scenes: PlannedScene[];
};

const MAX_SCENES = 24;

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePlan(value: any): StoryPlan | null {
  if (!value || !Array.isArray(value.scenes) || value.scenes.length < 2) return null;
  const characters: PlannedCharacter[] = Array.isArray(value.characters)
    ? value.characters.slice(0, 12).map((item: any, index: number) => ({
        id: clean(item.id, `character-${index + 1}`).replace(/\s+/g, "-").toLowerCase(),
        name: clean(item.name, `Character ${index + 1}`),
        role: clean(item.role, "supporting"),
        appearance: clean(item.appearance, "Maintain the same recognizable appearance across scenes."),
        wardrobe: clean(item.wardrobe, "Maintain consistent wardrobe unless the story requires a change."),
        voice: clean(item.voice, "Natural conversational delivery."),
      }))
    : [];

  const knownIds = new Set(characters.map((item) => item.id));
  const scenes: PlannedScene[] = value.scenes.slice(0, MAX_SCENES).map((item: any, index: number) => ({
    title: clean(item.title, `Scene ${index + 1}`),
    summary: clean(item.summary, clean(item.visualPrompt, "Story progression")),
    visualPrompt: clean(item.visualPrompt, clean(item.summary, "Cinematic story scene")),
    cameraDirection: clean(item.cameraDirection, index === 0 ? "Establishing push-in" : "Director choice"),
    location: clean(item.location, "Story location"),
    timeOfDay: clean(item.timeOfDay, "natural time of day"),
    characterIds: Array.isArray(item.characterIds)
      ? item.characterIds.map((id: unknown) => clean(id)).filter((id: string) => knownIds.has(id))
      : [],
    dialogue: Array.isArray(item.dialogue)
      ? item.dialogue.slice(0, 6).map((line: any) => ({
          characterId: clean(line.characterId),
          text: clean(line.text),
          delivery: clean(line.delivery, "natural"),
        })).filter((line: PlannedDialogue) => line.text)
      : [],
    continuityNotes: Array.isArray(item.continuityNotes)
      ? item.continuityNotes.map((note: unknown) => clean(note)).filter(Boolean).slice(0, 8)
      : [],
    durationSeconds: 8,
  }));

  return {
    source: "ai-gateway",
    title: clean(value.title, "Untitled story"),
    logline: clean(value.logline, scenes[0]?.summary ?? "Short cinematic story"),
    characters,
    scenes,
  };
}

function deterministicPlan(story: string): StoryPlan {
  const raw = story
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const words = story.trim().split(/\s+/);
  const beats = raw.length >= 3
    ? raw
    : Array.from({ length: Math.min(8, Math.max(3, Math.ceil(words.length / 24))) }, (_, index) => {
        const size = Math.ceil(words.length / Math.min(8, Math.max(3, Math.ceil(words.length / 24))));
        return words.slice(index * size, (index + 1) * size).join(" ");
      }).filter(Boolean);

  const scenes = beats.slice(0, MAX_SCENES).map((beat, index) => ({
    title: index === 0 ? "Opening" : index === beats.length - 1 ? "Ending" : `Scene ${index + 1}`,
    summary: beat,
    visualPrompt: beat,
    cameraDirection:
      index === 0 ? "Wide establishing shot moving into the lead character" :
      index === beats.length - 1 ? "Emotional closing shot with a clear visual resolution" :
      "Use a mix of medium coverage and motivated close-ups",
    location: "Preserve location logic from the story",
    timeOfDay: "Preserve time-of-day continuity",
    characterIds: [],
    dialogue: [],
    continuityNotes: [
      "Preserve character identity across adjacent scenes.",
      "Keep wardrobe, props, weather and location continuity unless the story explicitly changes them.",
    ],
    durationSeconds: 8,
  }));

  return {
    source: "deterministic-fallback",
    title: "Untitled story",
    logline: beats[0] ?? story.slice(0, 180),
    characters: [],
    scenes,
  };
}

export async function planStory(story: string, style: string, aspectRatio: string): Promise<StoryPlan> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return deterministicPlan(story);

  const system = [
    "You are the PixenarMV story planner.",
    "Return valid JSON only.",
    "Convert the user's story into a production-ready short film plan.",
    "Keep scenes renderable as independent 8-second AI video shots while preserving continuity.",
    "Create recurring character IDs, concise dialogue, camera direction, location, time of day and continuity notes.",
    "Use no more than 24 scenes and no more than 12 recurring characters.",
    "Never include markdown.",
  ].join(" ");

  const user = JSON.stringify({
    task: "plan_short_film",
    style,
    aspectRatio,
    story,
    requiredShape: {
      title: "string",
      logline: "string",
      characters: [{ id: "string", name: "string", role: "string", appearance: "string", wardrobe: "string", voice: "string" }],
      scenes: [{
        title: "string",
        summary: "string",
        visualPrompt: "string",
        cameraDirection: "string",
        location: "string",
        timeOfDay: "string",
        characterIds: ["character-id"],
        dialogue: [{ characterId: "character-id", text: "string", delivery: "string" }],
        continuityNotes: ["string"]
      }]
    }
  });

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.PIXENAR_STORY_MODEL || "openai/gpt-5.4-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });
    if (!response.ok) return deterministicPlan(story);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return deterministicPlan(story);
    const normalized = normalizePlan(JSON.parse(content));
    return normalized ?? deterministicPlan(story);
  } catch {
    return deterministicPlan(story);
  }
}
