import "server-only";

type Voice = {
  voice_id: string;
  name?: string;
  labels?: Record<string, string>;
  category?: string;
};

export type SpeechResult = {
  bytes: Uint8Array;
  mimeType: "audio/mpeg";
  durationSeconds: number;
  requestId: string | null;
  characterCost: number | null;
};

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured.");
  return key;
}

export function hasVoiceProviderConfiguration() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function listPixenarVoices(): Promise<Voice[]> {
  const response = await fetch(
    "https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=false",
    {
      headers: { "xi-api-key": apiKey() },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Unable to load ElevenLabs voices (${response.status}).`);
  }
  const data = await response.json();
  const voices = Array.isArray(data?.voices) ? data.voices : [];
  return voices
    .filter((voice: Voice) => typeof voice?.voice_id === "string" && voice.voice_id)
    .slice(0, 24);
}

export async function createSpeechWithTiming(
  text: string,
  voiceId: string,
): Promise<SpeechResult> {
  const normalizedText = text.trim().slice(0, 1200);
  if (!normalizedText) throw new Error("Dialogue text is empty.");

  const model = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId,
    )}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: normalizedText,
        model_id: model,
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs speech generation failed (${response.status}).`);
  }

  const payload = await response.json();
  const audioBase64 = payload?.audio_base64;
  if (typeof audioBase64 !== "string" || !audioBase64) {
    throw new Error("ElevenLabs returned no audio.");
  }

  const alignment = payload?.normalized_alignment ?? payload?.alignment;
  const ends = Array.isArray(alignment?.character_end_times_seconds)
    ? alignment.character_end_times_seconds.filter((value: unknown) => Number.isFinite(Number(value)))
    : [];
  const durationSeconds = ends.length
    ? Math.max(0.1, Number(ends[ends.length - 1]))
    : Math.max(0.8, normalizedText.length / 14);

  const cost = Number(response.headers.get("character-cost"));
  return {
    bytes: Uint8Array.from(Buffer.from(audioBase64, "base64")),
    mimeType: "audio/mpeg",
    durationSeconds,
    requestId: response.headers.get("request-id"),
    characterCost: Number.isFinite(cost) ? cost : null,
  };
}
