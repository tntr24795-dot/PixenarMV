import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectVideo } from "@/lib/providers/video";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Invoke from a trusted server only. No browser/client access.
// This endpoint does not debit or refund credits when provider billing is uncertain.
export async function POST(request: NextRequest) {
  const secret = process.env.RECONCILIATION_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  const { data: jobs, error } = await admin
    .from("generations")
    .select("id,provider,provider_task_id,status,provider_status,created_at")
    .in("status", ["queued", "processing"])
    .eq("provider_status", "billing_review")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ error: "Unable to load reconciliation queue" }, { status: 503 });

  const results: Array<{ id: string; action: string }> = [];
  for (const job of jobs ?? []) {
    if (!job.provider_task_id) {
      results.push({ id: job.id, action: "manual_review_no_provider_handle" });
      continue;
    }
    try {
      const state = await inspectVideo(job.provider_task_id, job.provider);
      if (state.status === "failed" && typeof state.refundable === "boolean") {
        const classification = state.refundable ? "confirmed_refundable" : "billed_failure";
        const { data: settled, error: settleError } = await admin.rpc("fail_generation", {
          p_generation_id: job.id,
          p_error_message: state.error ?? "Provider confirmed generation failure.",
          p_provider_status: classification,
        });
        results.push({ id: job.id, action: !settleError && settled ? classification : "manual_review_settlement_failed" });
      } else {
        // A successful provider job must be persisted via the normal render workflow.
        // Never charge a customer without an accessible finished video.
        results.push({ id: job.id, action: state.status === "succeeded" ? "manual_review_provider_succeeded" : "awaiting_provider_confirmation" });
      }
    } catch {
      results.push({ id: job.id, action: "manual_review_provider_unavailable" });
    }
  }

  return NextResponse.json({
    checked: results.length,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
