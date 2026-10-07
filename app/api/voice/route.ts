import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSpeechWithTiming,
  hasVoiceProviderConfiguration,
  listPixenarVoices,
} from "@/lib/providers/voice";

type DialogueLine = {
  characterId?: string;
  text?: string;
  delivery?: string;
};

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return length ? hash % length : 0;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const projectId = String(body?.projectId ?? "");
  if (!projectId) {
    return NextResponse.json({ error: "A project is required." }, { status: 400 });
  }
  if (!hasVoiceProviderConfiguration()) {
    return NextResponse.json(
      { error: "Dialogue voice generation is not configured on the server." },
      { status: 503 },
    );
  }

  const { supabase, userId } = await authenticatedClient();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: project }, { data: scenes }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,storyboard")
      .eq("id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("scenes")
      .select("id,position,start_seconds,continuity")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .order("position"),
  ]);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const voices = await listPixenarVoices();
  if (!voices.length) {
    return NextResponse.json({ error: "No ElevenLabs voices are available." }, { status: 503 });
  }

  const admin = createAdminClient();
  const voiceMap = new Map<string, string>();
  const generated: {
    sceneId: string;
    characterId: string;
    storagePath: string;
    offsetSeconds: number;
    durationSeconds: number;
    voiceId: string;
    text: string;
  }[] = [];

  for (const scene of scenes ?? []) {
    const continuity = (scene.continuity ?? {}) as Record<string, unknown>;
    const dialogue = Array.isArray(continuity.dialogue)
      ? (continuity.dialogue as DialogueLine[])
      : [];
    if (!dialogue.length) continue;

    const audio: Record<string, unknown>[] = [];
    let cursor = 0.25;
    for (let index = 0; index < dialogue.length; index += 1) {
      const line = dialogue[index];
      const text = String(line?.text ?? "").trim();
      if (!text) continue;
      const characterId = String(line?.characterId ?? `character-${index + 1}`);
      let voiceId = voiceMap.get(characterId);
      if (!voiceId) {
        voiceId = voices[stableIndex(characterId, voices.length)].voice_id;
        voiceMap.set(characterId, voiceId);
      }

      const speech = await createSpeechWithTiming(text, voiceId);
      const path = `${userId}/${projectId}/dialogue/${scene.id}/${index + 1}.mp3`;
      const { error: uploadError } = await admin.storage
        .from("source-media")
        .upload(path, speech.bytes, {
          contentType: speech.mimeType,
          upsert: true,
        });
      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      await admin
        .from("project_assets")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .eq("storage_path", path);
      const { error: assetError } = await admin.from("project_assets").insert({
        project_id: projectId,
        user_id: userId,
        kind: "dialogue_audio",
        storage_path: path,
        mime_type: speech.mimeType,
        size_bytes: speech.bytes.byteLength,
      });
      if (assetError) {
        return NextResponse.json({ error: assetError.message }, { status: 500 });
      }

      const item = {
        characterId,
        storagePath: path,
        offsetSeconds: cursor,
        durationSeconds: speech.durationSeconds,
        voiceId,
        text,
        delivery: String(line?.delivery ?? "natural"),
        requestId: speech.requestId,
        characterCost: speech.characterCost,
      };
      audio.push(item);
      generated.push({
        sceneId: scene.id,
        characterId,
        storagePath: path,
        offsetSeconds: Number(scene.start_seconds ?? 0) + cursor,
        durationSeconds: speech.durationSeconds,
        voiceId,
        text,
      });
      cursor += speech.durationSeconds + 0.2;
    }

    const { error: sceneUpdateError } = await admin
      .from("scenes")
      .update({ continuity: { ...continuity, audio } })
      .eq("id", scene.id)
      .eq("user_id", userId);
    if (sceneUpdateError) {
      return NextResponse.json({ error: sceneUpdateError.message }, { status: 500 });
    }
  }

  const storyboard = {
    ...(project.storyboard ?? {}),
    voiceover_status: generated.length ? "ready" : "not_required",
    voice_map: Object.fromEntries(voiceMap),
    voice_asset_count: generated.length,
    voice_generated_at: new Date().toISOString(),
  };
  const { error: projectUpdateError } = await admin
    .from("projects")
    .update({ storyboard })
    .eq("id", projectId)
    .eq("user_id", userId);
  if (projectUpdateError) {
    return NextResponse.json({ error: projectUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    status: generated.length ? "ready" : "not_required",
    generated: generated.length,
    voiceMap: Object.fromEntries(voiceMap),
  });
}
