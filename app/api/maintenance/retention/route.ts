import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRetentionFetch } from "@/lib/supabase/retention-fetch";
import { RetentionError, runRetention } from "@/lib/retention";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const runId = randomUUID();
  try {
    const admin = createAdminClient({ fetch: createRetentionFetch(runId) });
    const result = await runRetention(admin, request.nextUrl.searchParams.get("dryRun") === "1");
    console.info(JSON.stringify({ event: "retention.completed", runId, ...result }));
    return NextResponse.json({ runId, ...result });
  } catch (error) {
    const stage = error instanceof RetentionError ? error.stage : "unexpected";
    const code = error instanceof RetentionError ? error.code : "INTERNAL_ERROR";
    // Never log secrets, headers, JWTs, private paths or raw upstream messages.
    console.error(JSON.stringify({ event: "retention.failed", runId, stage, code }));
    return NextResponse.json(
      { error: "Retention maintenance failed.", runId, stage, code },
      { status: code === "PGRST303" ? 503 : 500 },
    );
  }
}
