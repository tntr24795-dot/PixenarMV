import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [{ data: generations, error: generationError }, { data: exports, error: exportError }] =
    await Promise.all([
      admin
        .from("generations")
        .select("id,output_path,project_id")
        .eq("status", "succeeded")
        .not("output_path", "is", null)
        .is("media_deleted_at", null)
        .lte("expires_at", now)
        .limit(200),
      admin
        .from("exports")
        .select("id,storage_path,project_id")
        .eq("status", "succeeded")
        .not("storage_path", "is", null)
        .is("media_deleted_at", null)
        .lte("expires_at", now)
        .limit(200),
    ]);

  if (generationError || exportError) {
    return NextResponse.json(
      { error: generationError?.message ?? exportError?.message ?? "Retention query failed." },
      { status: 500 },
    );
  }

  const generationPaths = (generations ?? [])
    .map((item) => item.output_path)
    .filter((value): value is string => Boolean(value));
  const exportPaths = (exports ?? [])
    .map((item) => item.storage_path)
    .filter((value): value is string => Boolean(value));
  const paths = [...new Set([...generationPaths, ...exportPaths])];

  if (paths.length) {
    const { error: storageError } = await admin.storage
      .from("generated-media")
      .remove(paths);
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }
  }

  const deletedAt = new Date().toISOString();
  if ((generations ?? []).length) {
    const { error } = await admin
      .from("generations")
      .update({ output_path: null, media_deleted_at: deletedAt })
      .in("id", (generations ?? []).map((item) => item.id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if ((exports ?? []).length) {
    const exportIds = (exports ?? []).map((item) => item.id);
    const { error } = await admin
      .from("exports")
      .update({ storage_path: null, media_deleted_at: deletedAt })
      .in("id", exportIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const item of exports ?? []) {
      if (!item.storage_path) continue;
      await admin
        .from("projects")
        .update({ final_output_path: null, updated_at: deletedAt })
        .eq("id", item.project_id)
        .eq("final_output_path", item.storage_path);
    }
  }

  return NextResponse.json({
    deletedAt,
    deletedObjects: paths.length,
    sceneVideos: generations?.length ?? 0,
    finalExports: exports?.length ?? 0,
  });
}
