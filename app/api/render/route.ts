import { PRICING_VERSION } from "@/lib/pricing";
import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { getWorld } from "workflow/runtime";
import { videoModels } from "@/lib/models";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { hasAdminConfiguration } from "@/lib/supabase/admin";
import { inspectVideo, hasVideoProviderConfiguration } from "@/lib/providers/video";
import { renderSceneWorkflow } from "@/workflows/render-scene";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const generationId = request.nextUrl.searchParams.get("generationId");
  if (generationId) {
    // Owner-scoped, read-only lookup. Never return the provider task handle.
    const { data: generation, error } = await supabase.from("generations")
      .select("provider,provider_task_id,status").eq("id", generationId).eq("user_id", userId).single();
    if (error || !generation) return NextResponse.json({ error: "Generation not found." }, { status: 404 });
    if (generation.provider !== "gateway" || generation.status !== "failed" || !generation.provider_task_id) {
      return NextResponse.json({ error: "Provider diagnostics are available for failed Gateway jobs only." }, { status: 409 });
    }
    try {
      const state = await inspectVideo(generation.provider_task_id, generation.provider);
      return NextResponse.json({ status: state.status, providerStatus: state.providerStatus, error: state.error ?? null }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Provider status lookup is temporarily unavailable." }, { status: 502 });
    }
  }
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

  const { data: project } = await supabase.from("projects").select("resolution,storyboard").eq("id", projectId).single();
  const isLongDrama = (project?.storyboard as {source?:string}|null)?.source === "long-drama";
  // No long-drama render until per-shot editorial approval and billing/E2E reconciliation are implemented.
  if (isLongDrama) return NextResponse.json({error:"Long Drama rendering is not enabled. Planning and scene review only.",code:"LONG_DRAMA_NOT_READY"},{status:409});
  if (isLongDrama) {
    const {data: prior} = await supabase.from("generations").select("id,status,workflow_run_id,credits_reserved").eq("project_id",projectId).eq("scene_id",sceneId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(prior){
      return NextResponse.json({jobId:prior.id,status:prior.status,workflowRunId:prior.workflow_run_id,credits:prior.credits_reserved,reused:true},{status:202});
    }
  }
  const resolution = String(body?.resolution ?? project?.resolution ?? "720p");
  // For long-drama the scene UUID is the stable reservation idempotency key.
  // It is deliberately not regenerated on retry. Failed shots require explicit reconciliation.
  const requestId = isLongDrama ? sceneId : crypto.randomUUID();

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

  if(error && isLongDrama && (error.code === "23505" || error.message.includes("duplicate key"))) {
    const {data: existing}=await supabase.from("generations").select("id,status,workflow_run_id,credits_reserved").eq("client_request_id",requestId).eq("scene_id",sceneId).eq("project_id",projectId).maybeSingle();
    if(existing) return NextResponse.json({jobId:existing.id,status:existing.status,workflowRunId:existing.workflow_run_id,credits:existing.credits_reserved,reused:true},{status:202});
  }
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

  let startedRun: Awaited<ReturnType<typeof start>> | undefined;
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
      start(renderSceneWorkflow, [String(data)], { world: (() => {
        const world = getWorld();
        function traced<T extends (...args: never[]) => unknown>(stage: string, operation: T): T {
          return (async (...args: Parameters<T>) => {
            const began = Date.now();
            console.info("render.workflow.stage", { generationId: data, stage, status: "started" });
            try {
              const result = await operation(...args);
              console.info("render.workflow.stage", { generationId: data, stage, status: "completed", latencyMs: Date.now() - began });
              return result;
            } catch (error) {
              console.error("render.workflow.stage", { generationId: data, stage, status: "failed", error: error instanceof Error ? error.message : "Unknown failure" });
              throw error;
            }
          }) as T;
        }
        return {
          ...world,
          getDeploymentId: traced("deployment", world.getDeploymentId.bind(world)),
          ...(world.getEncryptionKeyForRun ? { getEncryptionKeyForRun: traced("encryption", world.getEncryptionKeyForRun.bind(world)) } : {}),
          events: { ...world.events, create: traced("events.create", world.events.create.bind(world.events)) },
          queue: traced("queue", world.queue.bind(world)),
        };
      })() }),
      new Promise<never>((_, reject) => {
        startupTimer = setTimeout(() => reject(new Error("Workflow startup timed out after 30 seconds.")), 30_000);
      }),
    ]);
    startedRun = run;
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
    if (cancelled && !cancelError && startedRun) {
      try { await startedRun.cancel(); }
      catch (error) { console.error("render.workflow.cancel_failed", { generationId: data, error: error instanceof Error ? error.message : "Unknown cancellation failure" }); }
    }
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
