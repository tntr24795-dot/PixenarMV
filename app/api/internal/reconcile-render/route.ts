import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Preview safety gate: this endpoint is strictly read-only.
// Billing settlement must be implemented and independently verified before enabling writes.
export async function POST(request: NextRequest) {
  const secret = process.env.RECONCILIATION_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }
  if (
    !payload || typeof payload !== "object" || Array.isArray(payload) ||
    (payload as { dryRun?: unknown }).dryRun !== true
  ) {
    return NextResponse.json(
      { error: "Only dryRun: true is permitted; credit settlement is disabled" },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  const { data: jobs, error } = await admin
    .from("generations")
    .select("id,provider,status,provider_status,created_at,credits_reserved,provider_task_id")
    .in("status", ["queued", "processing"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Unable to load reconciliation queue" }, { status: 503 });
  }

  const results = (jobs ?? []).map((job) => ({
    id: job.id,
    provider: job.provider,
    status: job.status,
    providerStatus: job.provider_status,
    createdAt: job.created_at,
    reservedCredits: job.credits_reserved,
    action: job.provider_status === "billing_review"
      ? (job.provider_task_id ? "provider_billing_verification_required" : "manual_review_no_provider_handle")
      : "stale_job_review_required",
  }));

  return NextResponse.json({
    dryRun: true,
    checked: results.length,
    hasMore: results.length === 20,
    creditsModified: 0,
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
