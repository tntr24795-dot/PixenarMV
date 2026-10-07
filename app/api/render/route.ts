import { quoteVideo, PRICING_VERSION } from "@/lib/pricing";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { videoModels } from "@/lib/models";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { hasAdminConfiguration } from "@/lib/supabase/admin";
import { hasVideoProviderConfiguration } from "@/lib/providers/video";
import { renderSceneWorkflow } from "@/workflows/render-scene";
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body?.pricingVersion !== PRICING_VERSION) return NextResponse.json({error:"Pricing changed. Refresh before generating."},{status:409});
  const model = videoModels.find((item) => item.id === body?.modelId);
  if (!model?.available)
    return NextResponse.json(
      { error: "This model is currently unavailable." },
      { status: 400 },
    );
  if (!model.durations.includes(Number(body?.duration)))
    return NextResponse.json(
      { error: "Unsupported duration for this model." },
      { status: 400 },
    );
  if (!String(body?.prompt || "").trim())
    return NextResponse.json(
      { error: "A scene prompt is required." },
      { status: 400 },
    );
  const projectId = String(body?.projectId ?? ""),
    sceneId = String(body?.sceneId ?? "");
  if (!projectId || !sceneId)
    return NextResponse.json(
      { error: "A saved project and scene are required." },
      { status: 400 },
    );
  if (!hasAdminConfiguration() || !hasVideoProviderConfiguration(model.id))
    return NextResponse.json(
      {
        error:
          "Rendering is not configured yet. Add the server-side Supabase and video provider secrets in Vercel.",
        code: "PROVIDER_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: project } = await supabase.from("projects").select("resolution").eq("id", projectId).single();
  const resolution = String(body?.resolution ?? project?.resolution ?? "720p");
  let quote;
  try { quote = quoteVideo(model.id, Number(body?.duration), resolution); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid pricing." }, { status: 400 }); }
  const requestId = crypto.randomUUID();
  const { data, error } = await supabase.rpc("enqueue_generation", {
    p_project_id: projectId,
    p_scene_id: sceneId,
    p_model: model.id,
    p_duration: Number(body?.duration),
    p_prompt: String(body?.prompt),
    p_request_id: requestId,
    p_resolution: resolution,
  });
  if (error)
    return NextResponse.json(
      {
        error: error.message.includes("insufficient")
          ? "Insufficient credits. Add credits before generating this scene."
          : error.message,
      },
      { status: error.message.includes("insufficient") ? 402 : 400 },
    );
  try {
    const run = await start(renderSceneWorkflow, [String(data)]);
    const { error: attachError } = await supabase.rpc("attach_generation_workflow", {
      p_generation_id: data,
      p_workflow_run_id: run.runId,
    });
    if (attachError) throw attachError;
    return NextResponse.json(
      {
        jobId: data,
        workflowRunId: run.runId,
        status: "queued",
        credits: quote.credits,
        requestId,
      },
      { status: 202 },
    );
  } catch (workflowError) {
    // The worker may already have started; do not release provider-billed reservations.
    return NextResponse.json(
      {
        error:
          workflowError instanceof Error
            ? `Unable to start the render worker: ${workflowError.message}`
            : "Unable to start the render worker.",
      },
      { status: 503 },
    );
  }
}
