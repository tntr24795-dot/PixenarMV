import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";

const structure = [
  ["Intro", 0, 0.08],
  ["Verse 1", 0.08, 0.27],
  ["Chorus 1", 0.27, 0.45],
  ["Verse 2", 0.45, 0.63],
  ["Bridge", 0.63, 0.76],
  ["Final chorus", 0.76, 0.94],
  ["Outro", 0.94, 1],
] as const;

export async function POST(request: Request) {
  const body = await readJson(request);
  const projectId = String(body?.projectId ?? "");
  const duration = Math.round(Number(body?.duration));
  if (
    !projectId ||
    !Number.isFinite(duration) ||
    duration < 10 ||
    duration > 900
  )
    return NextResponse.json(
      { error: "A valid project and audio duration are required." },
      { status: 400 },
    );
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,audio_path,title")
    .eq("id", projectId)
    .single();
  if (projectError || !project?.audio_path)
    return NextResponse.json(
      { error: "Upload the master track before analysis." },
      { status: 400 },
    );
  const { count: existingGenerations } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (existingGenerations)
    return NextResponse.json(
      {
        error:
          "This project already has render history. Create a new project before replacing its analyzed storyboard.",
      },
      { status: 409 },
    );

  const sections = structure.map(([name, startRatio, endRatio]) => ({
    name,
    start: Math.round(duration * startRatio),
    end: Math.round(duration * endRatio),
  }));
  const scenes = [];
  let position = 0;
  for (const section of sections) {
    for (let start = section.start; start < section.end; start += 8) {
      const sceneDuration = Math.min(8, Math.max(2, section.end - start));
      scenes.push({
        project_id: projectId,
        user_id: userId,
        position,
        start_seconds: start,
        duration_seconds: sceneDuration,
        title: `${section.name} · Shot ${position + 1}`,
        section_name: section.name,
        prompt: `Cinematic visual for ${section.name}, beat-synced motion, consistent cast and art direction.`,
        camera_direction: "Director choice",
        continuity: { identity: true, wardrobe: true, palette: true },
        status: "queued",
      });
      position++;
    }
  }
  const analysis = {
    version: 1,
    duration,
    bpm: null,
    key: null,
    sections,
    scene_count: scenes.length,
    method: "timeline-structure",
    analyzed_at: new Date().toISOString(),
  };
  const { error: deleteError } = await supabase
    .from("scenes")
    .delete()
    .eq("project_id", projectId);
  if (deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  const { data: created, error: sceneError } = await supabase
    .from("scenes")
    .insert(scenes)
    .select(
      "id,position,title,section_name,start_seconds,duration_seconds,prompt,status",
    );
  if (sceneError)
    return NextResponse.json({ error: sceneError.message }, { status: 400 });
  const { error: updateError } = await supabase
    .from("projects")
    .update({
      duration_seconds: duration,
      song_analysis: analysis,
      storyboard: created,
      status: "storyboarding",
    })
    .eq("id", projectId);
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  return NextResponse.json({ analysis, scenes: created });
}
