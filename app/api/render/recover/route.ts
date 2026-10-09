import { NextRequest, NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectVideo } from "@/lib/providers/video";
import { persistProviderOutput } from "@/lib/providers/output";

export const maxDuration = 60;
const recoverableError = "AI Gateway completed without a downloadable video URL.";

export async function POST(request: NextRequest) {
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request);
  const { data: job } = await supabase.from("generations")
    .select("id,scene_id,provider,provider_task_id,status,error_message,credits_charged")
    .eq("id", String(body?.generationId ?? "")).eq("user_id", userId).single();
  if (!job) return NextResponse.json({ error: "Generation not found." }, { status: 404 });
  if (job.provider !== "gateway" || job.status !== "failed" || job.error_message !== recoverableError ||
      !job.provider_task_id || job.credits_charged <= 0) {
    return NextResponse.json({ error: "This job is not eligible for output recovery." }, { status: 409 });
  }
  try {
    // Status retrieval only. Never submit a new provider task or change credits.
    const state = await inspectVideo(job.provider_task_id, job.provider);
    if (state.status !== "succeeded") return NextResponse.json({ error: "Provider output is not ready." }, { status: 409 });
    const output = await persistProviderOutput(userId, job.id, state);
    const admin = createAdminClient();
    const { data: updated, error } = await admin.from("generations").update({
      status: "succeeded", progress: 100, provider_status: "succeeded", error_message: null,
      output_path: output.path, output_mime_type: output.mimeType,
      completed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
    }).eq("id", job.id).eq("user_id", userId).eq("status", "failed")
      .eq("error_message", recoverableError).select("id").maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: "Job state changed. Refresh the queue." }, { status: 409 });
    // Do not replace a newer successful version of the scene.
    const { error: sceneError } = await admin.from("scenes").update({
      status: "succeeded", active_generation_id: job.id, updated_at: new Date().toISOString(),
    }).eq("id", job.scene_id).eq("user_id", userId).eq("status", "failed").is("active_generation_id", null);
    if (sceneError) throw sceneError;
    return NextResponse.json({ status: "succeeded", recovered: true, additionalCredits: 0 });
  } catch (error) {
    console.error("render.output_recovery_failed", { generationId: job.id, error: error instanceof Error ? error.message : "Unknown failure" });
    return NextResponse.json({ error: "Unable to recover the existing output. Try again later." }, { status: 502 });
  }
}
