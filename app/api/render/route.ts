import { PRICING_VERSION } from "@/lib/pricing";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { videoModels } from "@/lib/models";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { hasAdminConfiguration } from "@/lib/supabase/admin";
import { hasVideoProviderConfiguration } from "@/lib/providers/video";
import { renderSceneWorkflow } from "@/workflows/render-scene";

export const maxDuration = 60;

export async function GET() {
  const { userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    workflowWorld: process.env.WORKFLOW_TARGET_WORLD ?? (process.env.VERCEL_DEPLOYMENT_ID ? "vercel" : "local"),
    hasDeploymentId: Boolean(process.env.VERCEL_DEPLOYMENT_ID),
    hasOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
  });
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body?.pricingVersion !== PRICING_VERSION)
    return NextResponse.json({error:"Pricing changed. Refresh before generating."},{status:409});

  const model = videoModels.find((item) => item.id === body?.modelId);
  if (!model?.available)
    return NextResponse.json({ error: "This model is currently unavailable." }, { status: 400 });

  if (!model.durations.includes(Number(body?.duration)))
    return NextResponse.json({ error: "Unsupported duration for this model." }, { status: 400 });

  if (!String(body?.prompt || "").trim())
    return NextResponse.json({ error: "A scene prompt is required." }, { status: 400 });

  const projectId = String(body?.projectId ?? "");
  const sceneId = String(body?.sceneId ?? "");
  if (!projectId || !sceneId)
    return NextResponse.json({ error: "A saved project and scene are required." }, { status: 400 });

  if (!hasAdminConfiguration() || !hasVideoProviderConfiguration(model.id))
    return NextResponse.json(
      { error: "Rendering is not configured yet. Add the server-side Supabase and video provider secrets in Vercel.", code: "PROVIDER_NOT_CONFIGURED" },
      { status: 503 },
    );

  const referenceAssetIds = Array.isArray(body?.referenceAssetIds)
    ? body.referenceAssetIds.filter((value: unknown): value is string => typeof value === "string").slice(0,40)
    : [];

  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("resolution").eq("id", projectId).single();
  const resolution = String(body?.resolution ?? project?.resolution ?? "720p");
  const requestId = crypto.randomUUID();

  const { data, error } = await supabase.rpc("enqueue_generation", {
    p_project_id: projectId,
    p_scene_id: sceneId,
    p_model: model.id,
    p_duration: Number(body?.duration),
    p_prompt: String(body?.prompt),
    p_request_id: requestId,
    p_resolution: resolution,
    p_reference_asset_ids: referenceAssetIds,
  });

  if (error)
    return NextResponse.json(
      { error: error.message.includes("insufficient") ? "Insufficient credits. Add credits before generating this scene." : error.message },
      { status: error.message.includes("insufficient") ? 402 : 400 },
    );

  console.info("render.reserved", { generationId: data });
  const { data: reserved, error: reservedError } = await supabase
    .from("generations")
    .select("credits_reserved")
    .eq("id", data)
    .single();

  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (reservedError) throw new Error(`Unable to read reserved credits: ${reservedError.message}`);
    console.info("render.workflow.start", {
      generationId: data,
      world: process.env.WORKFLOW_TARGET_WORLD ?? (process.env.VERCEL_DEPLOYMENT_ID ? "vercel" : "local"),
      hasDeploymentId: Boolean(process.env.VERCEL_DEPLOYMENT_ID),
      hasOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN),
    });
    const run = await Promise.race([
      start(renderSceneWorkflow, [String(data)]),
      new Promise<never>((_, reject) => {
        startupTimer = setTimeout(() => reject(new Error("Workflow startup timed out after 30 seconds.")), 30_000);
      }),
    ]);
    if (startupTimer) clearTimeout(startupTimer);
    console.info("render.workflow.started", { generationId: data, runId: run.runId });
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
        credits: reserved?.credits_reserved ?? null,
        requestId,
      },
      { status: 202 },
    );
  } catch (workflowError) {
    if (startupTimer) clearTimeout(startupTimer);
    // The RPC only cancels owned jobs still queued; processing jobs cannot be refunded here.
    const { data: cancelled, error: cancelError } = await supabase.rpc("cancel_generation", {
      p_generation_id: data,
    });
    console.error("render.workflow.start_failed", {
      generationId: data,
      error: workflowError instanceof Error ? workflowError.message : "Unknown workflow startup failure",
      reservationReleased: Boolean(cancelled && !cancelError),
    });
    return NextResponse.json(
      { error: workflowError instanceof Error ? `Unable to start the render worker: ${workflowError.message}` : "Unable to start the render worker." },
      { status: 503 },
    );
  }
}
