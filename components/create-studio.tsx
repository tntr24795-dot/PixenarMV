"use client";
import { PRICING_VERSION } from "@/lib/pricing";
import { ChangeEvent, useMemo, useState } from "react";
import { creditsFor, videoModels } from "@/lib/models";
import { createClient } from "@/lib/supabase/client";
import { mainSiteUrl } from "@/lib/brand-links";
import type { ShowcaseTemplate } from "@/lib/showcase";

type Mode = "film" | "music-video";
type InitialTemplate = Pick<ShowcaseTemplate, "slug" | "title" | "prompt" | "style" | "aspectRatio" | "modelId">;
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
  initialTemplate,
  configuredModelIds = [],
}: {
  configuredModelIds?: string[];
  initialMode?: Mode;
  initialProject?: InitialProject;
  initialTemplate?: InitialTemplate;
}) {
  const [mode, setMode] = useState<Mode>(
    initialProject
      ? initialProject.kind === "music_video"
        ? "music-video"
        : "film"
      : initialMode,
  );
  const [modelId, setModelId] = useState(initialTemplate?.modelId ?? "runway-4-5");
  const [duration, setDuration] = useState(8);
  const [resolution, setResolution] = useState("720p");
  const [selected, setSelected] = useState(1);
  const [title, setTitle] = useState(
    initialProject?.title ?? initialTemplate?.title ?? "Untitled project",
  );
  const [projectId, setProjectId] = useState<string | undefined>(
    initialProject?.id,
  );
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [analysisSections, setAnalysisSections] = useState<
    { name: string; start: number; end: number }[]
  >(initialProject?.song_analysis?.sections ?? []);
  const [story, setStory] = useState(initialTemplate?.prompt ?? "");
  const [storyStyle, setStoryStyle] = useState(initialTemplate?.style ?? "cinematic-realism");
  const [aspectRatio, setAspectRatio] = useState<string>(initialTemplate?.aspectRatio ?? "9:16");
  const [buildingStory, setBuildingStory] = useState(false);
  const [dramaReady, setDramaReady] = useState(
    Boolean(initialProject?.kind === "short_film" && initialProject.scenes.length),
  );
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
            resolution,
          ),
        0,
      ),
    [modelId, model, scenes, resolution],
  );
  function chooseModel(id: string) {
    const next = videoModels.find((m) => m.id === id)!;
    setModelId(id);
    if (!next.resolutions?.includes(resolution)) setResolution("720p");
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
  async function buildDramaStoryboard() {
    if (story.trim().length < 40) {
      setNotice("Tell us a little more — use at least 40 characters.");
      return;
    }
    setBuildingStory(true);
    setNotice("Turning your story into editable scenes…");
    try {
      const id = await ensureProject();
      const response = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pricingVersion: PRICING_VERSION,
          projectId: id,
          story,
          style: storyStyle,
          aspectRatio,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to build the storyboard.");
      setScenes(
        data.scenes.map(
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
      setSelected(1);
      setDramaReady(true);
      setNotice(
        `${data.storyboard.scene_count} editable drama scenes are ready. Add your cast, review prompts, then render.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to build the storyboard.",
      );
    } finally {
      setBuildingStory(false);
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
          pricingVersion: PRICING_VERSION,
          projectId: id,
          sceneId,
          modelId,
          resolution,
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
          ) : !dramaReady ? (
            <div className="storyBuilder">
              <div className="storyBuilderHead">
                <span className="storyIcon">✦</span>
                <div>
                  <p className="eyebrow">AI SHORT DRAMA CREATOR</p>
                  <h2>Turn any story into a mini drama.</h2>
                  <p>
                    Paste a story or script. PixenarMV will break it into
                    editable scenes with continuity-ready visual prompts.
                  </p>
                </div>
              </div>
              <label>
                Story or script
                <textarea
                  value={story}
                  maxLength={6000}
                  onChange={(event) => setStory(event.target.value)}
                  placeholder="Example: A shy office worker discovers that the anonymous notes on his desk are from the colleague he has secretly admired…"
                />
                <small>{story.length.toLocaleString()} / 6,000</small>
              </label>
              <div className="storyOptions">
                <label>
                  Visual style
                  <select
                    value={storyStyle}
                    onChange={(event) => setStoryStyle(event.target.value)}
                  >
                    <option value="cinematic-realism">Cinematic realism</option>
                    <option value="anime">Anime</option>
                    <option value="3d-animation">3D animation</option>
                    <option value="manga">Manga drama</option>
                    <option value="noir">Cinematic noir</option>
                  </select>
                </label>
                <label>
                  Format
                  <select
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value)}
                  >
                    <option value="9:16">9:16 · Reels / Shorts</option>
                    <option value="16:9">16:9 · YouTube / Film</option>
                  </select>
                </label>
              </div>
              <div className="storyFeatures">
                <span>✓ Automatic scene breakdown</span>
                <span>✓ Character continuity prompts</span>
                <span>✓ Editable 8-second shots</span>
              </div>
              <button
                className="primary storyBuildButton"
                disabled={buildingStory}
                onClick={buildDramaStoryboard}
              >
                {buildingStory
                  ? "Building storyboard…"
                  : "Create mini drama storyboard →"}
              </button>
              {notice && <p className="uploadNotice">{notice}</p>}
              <small className="voiceNote">
                Voiceover and dialogue generation will be enabled after the
                voice provider is connected. Visual scenes and final export use
                the existing private PixenarMV workflow.
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
              <button className="editStory" onClick={() => setDramaReady(false)}>
                Edit story and rebuild storyboard
              </button>
            </>
          )}
          {((mode === "film" && dramaReady) || analysisSections.length > 0) && (
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
        <aside
          className={`inspector ${
            mode === "film" && !dramaReady ? "storyInspectorHidden" : ""
          }`}
        >
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
                  <option disabled={!m.available || !configuredModelIds.includes(m.id)} value={m.id} key={m.id}>
                    {m.name}
                    {!m.available || !configuredModelIds.includes(m.id) ? " — Setup required" : ""}
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
          <label>
            Resolution
            <select value={resolution} onChange={event => setResolution(event.target.value)}>
              {(model.resolutions ?? ["720p"]).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
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
            <b>{creditsFor(modelId, duration, resolution)} credits</b>
          </div>
          <button
            className="generate"
            disabled={generating || !configuredModelIds.includes(modelId)}
            onClick={generateScene}
          >
            {generating ? "Queuing…" : "✦ Generate scene"}
          </button>
          <p className="total">Estimated storyboard: {total} credits</p>
          <p className="total">Provider-billed input policy violations are charged. Confirmed refundable failures return credits; uncertain jobs await review.</p>
          <details>
            <summary>Wan 3.0 pricing · 2–30 seconds</summary>
            <table><thead><tr><th>Model</th><th>480p</th><th>720p</th><th>1080p</th></tr></thead>
              <tbody><tr><td>Standard</td><td>5 cr/s</td><td>10 cr/s</td><td>19 cr/s</td></tr>
              <tr><td>Prime</td><td>8 cr/s</td><td>16 cr/s</td><td>32 cr/s</td></tr></tbody>
            </table>
            <p>720p is the default. Generation becomes available after provider setup. Multi-scene projects are quoted separately.</p>
          </details>
        </aside>
      </div>
      <footer className="studioCopyright">
        © 2026 PixenarMV. All rights reserved.
      </footer>
    </div>
  );
}
