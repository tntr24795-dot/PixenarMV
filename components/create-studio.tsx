"use client";
import { ChangeEvent, useMemo, useState } from "react";
import { creditsFor, videoModels } from "@/lib/models";
import { createClient } from "@/lib/supabase/client";
import { mainSiteUrl } from "@/lib/brand-links";

type Mode = "film" | "music-video";
type Scene = {
  id?: string;
  n: number;
  title: string;
  duration: number;
  prompt: string;
  status?: string;
};
type InitialProject = {
  id: string;
  title: string;
  kind: string;
  song_analysis: {
    sections?: { name: string; start: number; end: number }[];
  } | null;
  scenes: {
    id: string;
    position: number;
    title: string | null;
    duration_seconds: number;
    prompt: string;
    status: string;
  }[];
};
const filmScenes: Scene[] = [
  {
    n: 1,
    title: "The arrival",
    duration: 8,
    prompt:
      "Wide establishing shot. A lone car enters a rain-soaked city at midnight, cinematic reflections, slow dolly forward.",
  },
  {
    n: 2,
    title: "A familiar face",
    duration: 10,
    prompt:
      "Close-up of the lead character inside a quiet laundromat, soft practical lighting, restrained emotion.",
  },
  {
    n: 3,
    title: "The unanswered call",
    duration: 8,
    prompt:
      "Insert shot of a phone vibrating beside a paper coffee cup. The character hesitates before reaching for it.",
  },
];

export default function CreateStudio({
  initialMode = "film",
  initialProject,
}: {
  initialMode?: Mode;
  initialProject?: InitialProject;
}) {
  const [mode, setMode] = useState<Mode>(
    initialProject
      ? initialProject.kind === "music_video"
        ? "music-video"
        : "film"
      : initialMode,
  );
  const [modelId, setModelId] = useState("runway-4-5");
  const [duration, setDuration] = useState(8);
  const [selected, setSelected] = useState(1);
  const [title, setTitle] = useState(
    initialProject?.title ?? "Untitled project",
  );
  const [projectId, setProjectId] = useState<string | undefined>(
    initialProject?.id,
  );
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [analysisSections, setAnalysisSections] = useState<
    { name: string; start: number; end: number }[]
  >(initialProject?.song_analysis?.sections ?? []);
  const [scenes, setScenes] = useState<Scene[]>(
    initialProject?.scenes.length
      ? initialProject.scenes.map((scene) => ({
          id: scene.id,
          n: scene.position + 1,
          title: scene.title ?? `Scene ${scene.position + 1}`,
          duration: scene.duration_seconds,
          prompt: scene.prompt,
          status: scene.status,
        }))
      : filmScenes,
  );
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const model = videoModels.find((m) => m.id === modelId)!;
  const currentScene = scenes[selected - 1] ?? scenes[0];
  const total = useMemo(
    () =>
      scenes.reduce(
        (sum, scene) =>
          sum +
          creditsFor(
            modelId,
            model.durations.includes(scene.duration)
              ? scene.duration
              : model.durations[0],
          ),
        0,
      ),
    [modelId, model, scenes],
  );
  function chooseModel(id: string) {
    const next = videoModels.find((m) => m.id === id)!;
    setModelId(id);
    setDuration(
      next.durations.includes(duration) ? duration : next.durations[0],
    );
  }
  async function ensureProject() {
    if (projectId) return projectId;
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, type: mode }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to create project");
    setProjectId(data.id);
    return data.id as string;
  }
  async function uploadAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extensions = ["mp3", "wav", "m4a", "flac"];
    if (!extensions.includes(file.name.split(".").pop()?.toLowerCase() || "")) {
      setNotice("Please choose an MP3, WAV, M4A or FLAC file.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setNotice("Audio must be smaller than 500 MB.");
      return;
    }
    setUploading(true);
    setNotice("Creating project…");
    try {
      const id = await ensureProject();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/${id}/${crypto.randomUUID()}-${safe}`;
      setNotice("Uploading securely…");
      const { error: uploadError } = await supabase.storage
        .from("source-media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: assetError } = await supabase
        .from("project_assets")
        .insert({
          project_id: id,
          user_id: user.id,
          kind: "audio",
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
      if (assetError) throw assetError;
      const { error: updateError } = await supabase
        .from("projects")
        .update({ audio_path: path })
        .eq("id", id);
      if (updateError) throw updateError;
      setNotice("Analyzing song structure and building the storyboard…");
      const audioDuration = await new Promise<number>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
          const value = audio.duration;
          URL.revokeObjectURL(url);
          Number.isFinite(value)
            ? resolve(value)
            : reject(new Error("Unable to read audio duration."));
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Unable to read audio metadata."));
        };
        audio.src = url;
      });
      const analysisResponse = await fetch("/api/song-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: id, duration: audioDuration }),
      });
      const analysisData = await analysisResponse.json();
      if (!analysisResponse.ok)
        throw new Error(analysisData.error || "Song analysis failed.");
      setScenes(
        analysisData.scenes.map(
          (scene: {
            id: string;
            position: number;
            title: string;
            duration_seconds: number;
            prompt: string;
            status: string;
          }) => ({
            id: scene.id,
            n: scene.position + 1,
            title: scene.title,
            duration: scene.duration_seconds,
            prompt: scene.prompt,
            status: scene.status,
          }),
        ),
      );
      setAnalysisSections(analysisData.analysis.sections);
      setSelected(1);
      setNotice(
        `${file.name} analyzed — ${analysisData.analysis.scene_count} editable scenes ready.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  function updatePrompt(prompt: string) {
    setScenes((current) =>
      current.map((scene, index) =>
        index === selected - 1 ? { ...scene, prompt } : scene,
      ),
    );
  }
  async function saveTitle() {
    if (!projectId) return;
    await createClient()
      .from("projects")
      .update({ title: title.trim() || "Untitled project" })
      .eq("id", projectId);
  }
  async function generateScene() {
    setGenerating(true);
    setNotice("");
    try {
      const id = await ensureProject();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      let sceneId = currentScene.id;
      if (!sceneId) {
        const { data, error } = await supabase
          .from("scenes")
          .insert({
            project_id: id,
            user_id: user.id,
            position: selected - 1,
            title: currentScene.title,
            duration_seconds: duration,
            prompt: currentScene.prompt,
            model: modelId,
            status: "queued",
          })
          .select("id")
          .single();
        if (error) throw error;
        sceneId = data.id;
        setScenes((current) =>
          current.map((scene, index) =>
            index === selected - 1 ? { ...scene, id: sceneId } : scene,
          ),
        );
      }
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          sceneId,
          modelId,
          duration,
          prompt: currentScene.prompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to queue scene.");
      setNotice(
        `Scene queued successfully · ${data.credits} credits reserved.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to queue scene.",
      );
    } finally {
      setGenerating(false);
    }
  }
  async function exportProject() {
    setExporting(true);
    setNotice("");
    try {
      const id = await ensureProject();
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start final export.");
      window.location.assign("/renders");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start final export.";
      setNotice(message);
      window.alert(message);
      setExporting(false);
    }
  }
  return (
    <div className="studio">
      <div className="studioBar">
        <a href="/studio" className="back">
          ←
        </a>
        <div className="brand compact">
          <span className="brandMark">P</span>
          <span>
            PIXENAR<span>MV</span>
          </span>
        </div>
        <div className="projectTitle">
          <input
            aria-label="Project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
          />
          <span>{projectId ? "Saved privately" : "Draft"} · Autosaved</span>
        </div>
        <div className="barActions">
          <a className="homeLink" href={mainSiteUrl}>
            Main website
          </a>
          <button className="ghost">Preview</button>
          <button className="primary" disabled={exporting} onClick={exportProject}>
            {exporting ? "Preparing…" : "Export"}
          </button>
        </div>
      </div>
      <div className="studioBody">
        <aside className="sceneRail">
          <div className="railHead">
            <div>
              <b>Storyboard</b>
              <span>
                {scenes.length} scenes ·{" "}
                {Math.round(
                  scenes.reduce((sum, scene) => sum + scene.duration, 0),
                )}
                s
              </span>
            </div>
            <button>＋</button>
          </div>
          {scenes.map((scene) => (
            <button
              onClick={() => setSelected(scene.n)}
              className={`sceneItem ${selected === scene.n ? "selected" : ""}`}
              key={scene.n}
            >
              <span className="sceneThumb">
                {scene.n}
                <i>▶</i>
              </span>
              <span>
                <b>{scene.title}</b>
                <small>{scene.duration}s · Draft</small>
              </span>
            </button>
          ))}
          <button className="addScene">＋ Add scene</button>
        </aside>
        <section className="canvasArea">
          <div className="modeTabs" role="tablist">
            <button
              onClick={() => setMode("film")}
              className={mode === "film" ? "active" : ""}
            >
              Short film
            </button>
            <button
              onClick={() => setMode("music-video")}
              className={mode === "music-video" ? "active" : ""}
            >
              Music video
            </button>
          </div>
          {mode === "music-video" && analysisSections.length ? (
            <div className="analysisReady">
              <span className="analysisIcon">✓</span>
              <p className="eyebrow">SONG ANALYSIS COMPLETE</p>
              <h2>Your full-song storyboard is ready.</h2>
              <p>
                {scenes.length} editable scenes mapped across{" "}
                {analysisSections.length} song sections. Select any scene in the
                storyboard to direct its prompt, model and camera.
              </p>
              <div className="sectionMap">
                {analysisSections.map((section) => (
                  <span key={section.name}>
                    <b>{section.name}</b>
                    <small>
                      {Math.floor(section.start / 60)}:
                      {String(section.start % 60).padStart(2, "0")}–
                      {Math.floor(section.end / 60)}:
                      {String(section.end % 60).padStart(2, "0")}
                    </small>
                  </span>
                ))}
              </div>
              <button className="ghost" onClick={() => setAnalysisSections([])}>
                Replace audio
              </button>
            </div>
          ) : mode === "music-video" ? (
            <div className="audioDrop">
              <span>♫</span>
              <h2>Upload your master track</h2>
              <p>MP3, WAV, M4A or FLAC · private storage</p>
              <label className={`primary ${uploading ? "disabled" : ""}`}>
                {uploading ? "Uploading…" : "Choose audio file"}
                <input
                  hidden
                  disabled={uploading}
                  type="file"
                  accept=".mp3,.wav,.m4a,.flac,audio/*"
                  onChange={uploadAudio}
                />
              </label>
              {notice && <p className="uploadNotice">{notice}</p>}
              <small>
                Only upload audio you own or have permission to use.
              </small>
            </div>
          ) : (
            <>
              <div className="viewer">
                <div className="safeFrame">
                  <span>SCENE {selected}</span>
                  <div className="cinemaOrb" />
                  <p>{currentScene.title}</p>
                </div>
                <button className="viewerPlay">▶</button>
                <span className="timecode">
                  00:00 / 00:
                  {String(currentScene.duration).padStart(2, "0")}
                </span>
              </div>
            </>
          )}
          {(mode === "film" || analysisSections.length > 0) && (
            <div className="timeline">
              <div className="timelineTop">
                <b>Timeline</b>
                <span>{scenes.length} scenes · {Math.round(scenes.reduce((sum, scene) => sum + scene.duration, 0))}s</span>
              </div>
              <div className="tracks">
                <div className="trackLabel">VIDEO</div>
                {scenes.map((s) => (
                  <div
                    key={s.n}
                    className={`clip c${s.n}`}
                    style={{ flex: s.duration }}
                  >
                    <b>{s.n}. {s.title}</b>
                    <small>{s.duration}s</small>
                  </div>
                ))}
              </div>
              <div className="tracks audio">
                <div className="trackLabel">AUDIO</div>
                <div className="wave">
                  {mode === "music-video" ? "MASTER TRACK · " : "SCENE AUDIO · "}
                  ▂▃▅▇▆▄▂▃▆▇▅▃▂▃▅▆▇▅▃▂▂▄▆▇▆▄▃▂▃▅▇▆▃
                </div>
              </div>
            </div>
          )}
        </section>
        <aside className="inspector">
          <div className="inspectorTitle">
            <div>
              <b>Scene {selected}</b>
              <span>{currentScene.title}</span>
            </div>
            <button>⋯</button>
          </div>
          <label>
            Scene prompt
            <textarea
              value={currentScene.prompt}
              onChange={(event) => updatePrompt(event.target.value)}
            />
          </label>
          <div className="labelRow">
            <label>
              Video model
              <select
                value={modelId}
                onChange={(e) => chooseModel(e.target.value)}
              >
                {videoModels.map((m) => (
                  <option disabled={!m.available} value={m.id} key={m.id}>
                    {m.name}
                    {!m.available ? " — Paused" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duration
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {model.durations.map((d) => (
                  <option value={d} key={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="modelHint">
            <b>{model.badge}</b>
            <span>{model.bestFor}</span>
          </div>
          <label>
            Character reference
            <button
              className="reference"
              onClick={() => (location.href = "/characters")}
            >
              <span>＋</span>
              <div>
                <b>Add a character</b>
                <small>Keep identity consistent</small>
              </div>
            </button>
          </label>
          <label>
            Camera direction
            <select defaultValue="slow-dolly">
              <option value="slow-dolly">Slow dolly forward</option>
              <option>Static tripod</option>
              <option>Handheld follow</option>
              <option>Wide orbit</option>
            </select>
          </label>
          <div className="cost">
            <span>Estimated scene cost</span>
            <b>{creditsFor(modelId, duration)} credits</b>
          </div>
          <button
            className="generate"
            disabled={generating}
            onClick={generateScene}
          >
            {generating ? "Queuing…" : "✦ Generate scene"}
          </button>
          <p className="total">Estimated storyboard: {total} credits</p>
        </aside>
      </div>
      <footer className="studioCopyright">
        © 2026 PixenarMV. All rights reserved.
      </footer>
    </div>
  );
}
