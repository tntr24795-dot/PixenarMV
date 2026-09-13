import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { createAdminClient, hasAdminConfiguration } from "@/lib/supabase/admin";
import { exportProjectWorkflow } from "@/workflows/export-project";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = request.nextUrl.searchParams.get("projectId");
  let query = supabase
    .from("exports")
    .select(
      "id,project_id,status,progress,provider_status,error_message,storage_path,output_mime_type,created_at,completed_at,workflow_run_id,projects(title,kind)",
    )
    .order("created_at", { ascending: false })
    .limit(30);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const exportsWithUrls = await Promise.all(
    (data ?? []).map(async (job) => {
      if (!job.storage_path) return { ...job, storage_path: undefined, signed_url: null };
      const { data: signed } = await supabase.storage
        .from("generated-media")
        .createSignedUrl(job.storage_path, 60 * 60);
      return { ...job, storage_path: undefined, signed_url: signed?.signedUrl ?? null };
    }),
  );
  return NextResponse.json(
    { exports: exportsWithUrls },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const projectId = String(body?.projectId ?? "");
  if (!projectId) {
    return NextResponse.json({ error: "A project is required." }, { status: 400 });
  }
  if (!hasAdminConfiguration()) {
    return NextResponse.json(
      { error: "Final export is not configured on the server." },
      { status: 503 },
    );
  }
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: exportId, error } = await supabase.rpc("enqueue_export", {
    p_project_id: projectId,
  });
  if (error || !exportId) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to create the final export." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("exports")
    .select("id,user_id,status,workflow_run_id")
    .eq("id", exportId)
    .eq("user_id", userId)
    .single();
  if (existingError || !existing) {
    return NextResponse.json({ error: "Export job was not found." }, { status: 404 });
  }
  if (existing.workflow_run_id) {
    return NextResponse.json(
      { exportId, workflowRunId: existing.workflow_run_id, status: existing.status },
      { status: 202 },
    );
  }

  try {
    const run = await start(exportProjectWorkflow, [String(exportId)]);
    const { error: attachError } = await admin
      .from("exports")
      .update({ workflow_run_id: run.runId })
      .eq("id", exportId)
      .eq("user_id", userId)
      .is("workflow_run_id", null);
    if (attachError) throw attachError;
    return NextResponse.json(
      { exportId, workflowRunId: run.runId, status: "queued" },
      { status: 202 },
    );
  } catch (workflowError) {
    const message =
      workflowError instanceof Error
        ? `Unable to start the export worker: ${workflowError.message}`
        : "Unable to start the export worker.";
    await admin
      .from("exports")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", exportId)
      .eq("user_id", userId);
    await admin
      .from("projects")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("user_id", userId);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
