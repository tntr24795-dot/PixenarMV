import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";

const allowedModels = new Set([
  "veo-3-1-fast",
  "wan-3-0",
  "wan-3-0-prime",
  "gemini-omni-flash",
  "runway-4-5",
  "seedance-2-0",
  "seedance-2-5",
]);

export async function PATCH(request: Request) {
  const body = await readJson(request);
  const sceneId = String(body?.sceneId ?? "");
  if (!sceneId) {
    return NextResponse.json({ error: "Scene id is required." }, { status: 400 });
  }

  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const values: Record<string, unknown> = {};
  if (body?.title !== undefined) {
    const title = String(body.title).trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "Scene title cannot be empty." }, { status: 400 });
    values.title = title;
  }
  if (body?.prompt !== undefined) values.prompt = String(body.prompt).trim().slice(0, 6000);
  if (body?.cameraDirection !== undefined) values.camera_direction = String(body.cameraDirection).trim().slice(0, 120) || null;
  if (body?.modelId !== undefined) {
    const modelId = String(body.modelId);
    if (!allowedModels.has(modelId)) return NextResponse.json({ error: "Unsupported video model." }, { status: 400 });
    values.model = modelId;
  }
  if (body?.durationSeconds !== undefined) {
    const duration = Number(body.durationSeconds);
    if (!Number.isFinite(duration) || duration < 2 || duration > 30) {
      return NextResponse.json({ error: "Scene duration must be between 2 and 30 seconds." }, { status: 400 });
    }
    values.duration_seconds = duration;
  }
  if (!Object.keys(values).length) {
    return NextResponse.json({ error: "No scene changes were provided." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scenes")
    .update(values)
    .eq("id", sceneId)
    .eq("user_id", userId)
    .select("id,position,title,duration_seconds,prompt,status,camera_direction,model")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Scene not found." }, { status: 404 });

  if (body?.durationSeconds !== undefined) {
    const { data: allScenes, error: listError } = await supabase
      .from("scenes")
      .select("id,position,duration_seconds")
      .eq("project_id", String(body?.projectId ?? ""))
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (!listError && allScenes?.length) {
      let cursor = 0;
      for (const scene of allScenes) {
        await supabase
          .from("scenes")
          .update({ start_seconds: cursor })
          .eq("id", scene.id)
          .eq("user_id", userId);
        cursor += Number(scene.duration_seconds ?? 0);
      }
      if (body?.projectId) {
        await supabase
          .from("projects")
          .update({ duration_seconds: cursor })
          .eq("id", String(body.projectId))
          .eq("user_id", userId);
      }
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const body = await readJson(request);
  const sceneId = String(body?.sceneId ?? "");
  const projectId = String(body?.projectId ?? "");
  if (!sceneId || !projectId) {
    return NextResponse.json({ error: "Scene and project are required." }, { status: 400 });
  }

  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count: renderHistory } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("scene_id", sceneId)
    .eq("user_id", userId);
  if (renderHistory) {
    return NextResponse.json(
      { error: "This scene has render history and cannot be deleted. Keep it for auditability or create a new project version." },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase
    .from("scenes")
    .delete()
    .eq("id", sceneId)
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  const { data: remaining, error: listError } = await supabase
    .from("scenes")
    .select("id,position,duration_seconds")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });

  let cursor = 0;
  for (let index = 0; index < (remaining ?? []).length; index += 1) {
    const scene = remaining![index];
    await supabase
      .from("scenes")
      .update({ position: index, start_seconds: cursor })
      .eq("id", scene.id)
      .eq("user_id", userId);
    cursor += Number(scene.duration_seconds ?? 0);
  }

  await supabase
    .from("projects")
    .update({ duration_seconds: cursor })
    .eq("id", projectId)
    .eq("user_id", userId);

  return NextResponse.json({ deleted: true, sceneCount: remaining?.length ?? 0, durationSeconds: cursor });
}
