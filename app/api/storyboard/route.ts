import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";

const styles = new Set([
  "cinematic-realism",
  "anime",
  "3d-animation",
  "manga",
  "noir",
]);

function storyBeats(source: string) {
  const beats = source
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?。！？])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (beats.length >= 3) return beats.slice(0, 12);
  const words = source.trim().split(/\s+/);
  const size = Math.max(12, Math.ceil(words.length / 5));
  return Array.from({ length: Math.ceil(words.length / size) }, (_, index) =>
    words.slice(index * size, (index + 1) * size).join(" "),
  ).filter(Boolean);
}

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

  const beats = storyBeats(story);
  if (beats.length < 2)
    return NextResponse.json(
      { error: "Add a little more story detail so scenes can be created." },
      { status: 400 },
    );

  const scenes = beats.map((beat, position) => ({
    project_id: projectId,
    user_id: userId,
    position,
    start_seconds: position * 8,
    duration_seconds: 8,
    title: `Story beat ${position + 1}`,
    section_name:
      position === 0
        ? "Opening"
        : position === beats.length - 1
          ? "Ending"
          : "Story",
    prompt: `${style.replaceAll("-", " ")} short-drama scene, ${aspectRatio} composition. ${beat} Preserve the approved cast identity, wardrobe, location logic and visual palette. Expressive acting, clear blocking, cinematic camera movement, no text or watermark.`,
    camera_direction:
      position === 0
        ? "Establishing push-in"
        : position === beats.length - 1
          ? "Emotional closing shot"
          : "Director choice",
    continuity: {
      identity: true,
      wardrobe: true,
      palette: true,
      storyBeat: beat,
      visualStyle: style,
      aspectRatio,
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
    voiceover_status: "not_configured",
    created_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase
    .from("projects")
    .update({
      concept: story,
      aspect_ratio: aspectRatio,
      duration_seconds: scenes.length * 8,
      storyboard: created,
      status: "storyboarding",
    })
    .eq("id", projectId);
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ storyboard, scenes: created });
}
