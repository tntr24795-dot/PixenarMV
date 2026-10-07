import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { planStory } from "@/lib/story-planner";

const styles = new Set([
  "cinematic-realism",
  "anime",
  "3d-animation",
  "manga",
  "noir",
]);

export async function POST(request: Request) {
  const body = await readJson(request);
  const projectId = String(body?.projectId ?? "");
  const story = String(body?.story ?? "").trim();
  const style = styles.has(String(body?.style))
    ? String(body?.style)
    : "cinematic-realism";
  const aspectRatio = body?.aspectRatio === "16:9" ? "16:9" : "9:16";

  if (!projectId || story.length < 40 || story.length > 6000)
    return NextResponse.json(
      { error: "Enter a story between 40 and 6,000 characters." },
      { status: 400 },
    );

  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  if (!project)
    return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { count: existingGenerations } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (existingGenerations)
    return NextResponse.json(
      {
        error:
          "This project already has render history. Create a new project before replacing its story.",
      },
      { status: 409 },
    );

  const plan = await planStory(story, style, aspectRatio);
  if (plan.scenes.length < 2)
    return NextResponse.json(
      { error: "Add a little more story detail so scenes can be created." },
      { status: 400 },
    );

  const scenes = plan.scenes.map((planned, position) => ({
    project_id: projectId,
    user_id: userId,
    position,
    start_seconds: position * 8,
    duration_seconds: 8,
    title: planned.title,
    section_name:
      position === 0
        ? "Opening"
        : position === plan.scenes.length - 1
          ? "Ending"
          : "Story",
    prompt: [
      `${style.replaceAll("-", " ")} short-drama scene, ${aspectRatio} composition.`,
      planned.visualPrompt,
      `Location: ${planned.location}. Time: ${planned.timeOfDay}.`,
      planned.dialogue.length
        ? `Dialogue: ${planned.dialogue.map((line) => `${line.characterId}: "${line.text}" (${line.delivery})`).join(" ")}`
        : "",
      "Preserve approved cast identity, wardrobe, props, location logic and visual palette. Expressive acting, clear blocking, cinematic camera movement, no text or watermark.",
    ].filter(Boolean).join(" "),
    camera_direction: planned.cameraDirection,
    continuity: {
      identity: true,
      wardrobe: true,
      palette: true,
      storyBeat: planned.summary,
      visualStyle: style,
      aspectRatio,
      location: planned.location,
      timeOfDay: planned.timeOfDay,
      characterIds: planned.characterIds,
      dialogue: planned.dialogue,
      notes: planned.continuityNotes,
    },
    status: "queued",
  }));

  const { error: deleteError } = await supabase
    .from("scenes")
    .delete()
    .eq("project_id", projectId);
  if (deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  const { data: created, error: sceneError } = await supabase
    .from("scenes")
    .insert(scenes)
    .select("id,position,title,duration_seconds,prompt,status");
  if (sceneError)
    return NextResponse.json({ error: sceneError.message }, { status: 400 });

  const storyboard = {
    version: 1,
    source: "story-to-drama",
    story,
    style,
    aspect_ratio: aspectRatio,
    scene_count: scenes.length,
    planner_source: plan.source,
    title: plan.title,
    logline: plan.logline,
    characters: plan.characters,
    planned_scenes: plan.scenes,
    voiceover_status: plan.scenes.some((scene) => scene.dialogue.length) ? "planned" : "not_required",
    created_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase
    .from("projects")
    .update({
      concept: story,
      aspect_ratio: aspectRatio,
      duration_seconds: scenes.length * 8,
      storyboard,
      status: "storyboarding",
    })
    .eq("id", projectId);
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ storyboard, scenes: created });
}
