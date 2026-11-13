import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Read-only authorization diagnostic for the STUDIO product.
 * Deliberately deny-by-default until central product entitlements are migrated.
 * Never use this endpoint as a generation gate until all paid plans are mapped.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "Entitlement lookup failed" }, { status: 503 });
  }

  const now = Date.now();
  const hasStudioSubscription = (data ?? []).some((row) =>
    row.plan === "studio" &&
    (row.status === "active" || row.status === "trialing") &&
    typeof row.current_period_end === "string" &&
    Number.isFinite(Date.parse(row.current_period_end)) &&
    Date.parse(row.current_period_end) > now
  );
  return NextResponse.json(
    { product: "studio", authenticated: true, hasStudioSubscription, source: "legacy_subscriptions", centralSSOEnabled: false },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
