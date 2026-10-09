import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { renderSceneWorkflow } from "@/workflows/render-scene";

export const maxDuration = 60;

const TOKEN = "e2e-gemini-20261009-7f4d2a9c";
const GENERATION_ID = "f44f485a-18b4-4c3b-8e9a-19d03ce25a6b";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const run = await start(renderSceneWorkflow, [GENERATION_ID]);
  return NextResponse.json({ generationId: GENERATION_ID, runId: run.runId, status: "started" });
}
