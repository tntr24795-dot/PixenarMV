import { NextResponse } from "next/server";

export async function GET() {
  const aiKey = process.env.AI_GATEWAY_API_KEY;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const result: Record<string, unknown> = {
    aiGatewayConfigured: Boolean(aiKey),
    elevenLabsConfigured: Boolean(elevenKey),
  };
  if (elevenKey) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=1&include_total_count=false", {
        headers: { "xi-api-key": elevenKey },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      result.elevenLabs = { ok: response.ok, status: response.status };
    } catch (error) {
      result.elevenLabs = { ok: false, error: error instanceof Error ? error.message : "request failed" };
    }
  }
  if (aiKey) {
    try {
      const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.PIXENAR_STORY_MODEL || "openai/gpt-5.4-mini",
          messages: [{ role: "user", content: "Reply with OK only." }],
          max_tokens: 4,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(20000),
      });
      result.aiGateway = { ok: response.ok, status: response.status };
    } catch (error) {
      result.aiGateway = { ok: false, error: error instanceof Error ? error.message : "request failed" };
    }
  }
  return NextResponse.json(result);
}
