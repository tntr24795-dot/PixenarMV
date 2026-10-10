import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

export const maxDuration = 60;
import { authenticatedClient, readJson } from "@/lib/api/auth";

export async function GET() {
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("generations")
    .select(
      "id,project_id,scene_id,model,status,credits_reserved,credits_charged,error_message,created_at,completed_at,projects(title),scenes!generations_scene_id_fkey(title)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ generations: data });
}
export async function DELETE(request: Request) {
  const body = await readJson(request);
  const id = String(body?.id ?? "");
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: generation, error: lookupError } = await supabase
    .from("generations").select("status,workflow_run_id")
    .eq("id", id).eq("user_id", userId).single();
  if (lookupError || !generation)
    return NextResponse.json({ error: "Generation not found." }, { status: 404 });

  // A repeat request must still stop the worker after a previous platform failure.
  if (generation.status !== "cancelled") {
    const { error } = await supabase.rpc("cancel_generation", { p_generation_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  }
  try {
    if (generation.workflow_run_id) {
      const run = getRun(generation.workflow_run_id);
      const status = await run.status;
      if (!["completed", "failed", "cancelled"].includes(status)) await run.cancel();
      const confirmed = await run.status;
      if (!["completed", "failed", "cancelled"].includes(confirmed))
        throw new Error("Workflow cancellation is not confirmed.");
    }
    return NextResponse.json({ cancelled: true, workflowStopped: true });
  } catch (error) {
    console.error("render.workflow.cancel_failed", { generationId: id,
      error: error instanceof Error ? error.message : "Unknown cancellation failure" });
    return NextResponse.json({ cancelled: true, workflowStopped: false,
      error: "Credits were released, but stopping the worker failed. Retry cancellation." },
      { status: 502 });
  }
}
