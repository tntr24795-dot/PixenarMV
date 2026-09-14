import Link from "next/link";
import { mainSiteUrl } from "@/lib/brand-links";
type SavedProject = {
  id: string;
  title: string;
  kind: string;
  status: string;
  updated_at: string;
  duration_seconds: number | null;
};
const samples: SavedProject[] = [
  {
    id: "sample-1",
    title: "Cold as the Rain",
    kind: "music_video",
    status: "storyboarding",
    updated_at: new Date().toISOString(),
    duration_seconds: null,
  },
  {
    id: "sample-2",
    title: "Neon After Midnight",
    kind: "short_film",
    status: "draft",
    updated_at: new Date().toISOString(),
    duration_seconds: null,
  },
];
const progressByStatus: Record<string, number> = {
  draft: 12,
  storyboarding: 38,
  generating: 62,
  rendering: 84,
  completed: 100,
  failed: 0,
};
export default function Dashboard({
  savedProjects = [],
  credits = 0,
  role = "user",
}: {
  savedProjects?: SavedProject[];
  credits?: number;
  role?: "user" | "admin";
}) {
  const empty = savedProjects.length === 0;
  const projects = empty ? samples : savedProjects;
  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brandMark">P</span>
          <span>
            PIXENAR<span>MV</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <a className="nav active" href="#projects">
            <span>◫</span>Projects
          </a>
          <Link className="nav" href="/create">
            <span>✦</span>Create
          </Link>
          <Link className="nav" href="/characters">
            <span>♙</span>Characters
          </Link>
          <a className="nav" href="#assets">
            <span>▣</span>Assets
          </a>
          <Link className="nav" href="/renders">
            <span>◉</span>Render queue
          </Link>
        </nav>
        <div className="sideBottom">
          <a className="nav mainSiteLink" href={mainSiteUrl}>
            <span>⌂</span>Main website
          </a>
          <div className="creditCard">
            <small>AVAILABLE CREDITS</small>
            <strong>{credits.toLocaleString()}</strong>
            <span>Secure account wallet</span>
            <button>Manage plan</button>
          </div>
          <a className="nav" href="#settings">
            <span>⚙</span>Settings
          </a>
        </div>
      </aside>
      <section className="content" id="projects">
        <header>
          <div>
            <p className="eyebrow">PIXENAR CREATIVE CLOUD</p>
            <h1>
              Your studio {role === "admin" ? <span className="adminBadge">Admin</span> : null}
            </h1>
            <p>
              Build stories scene by scene. Keep every character, shot and sound
              in one place.
            </p>
          </div>
          <Link className="primary" href="/create">
            <span>＋</span>New project
          </Link>
        </header>
        <div className="stats">
          <article>
            <span>Active projects</span>
            <strong>
              {savedProjects.filter((p) => p.status !== "completed").length}
            </strong>
            <em>Across film and music</em>
          </article>
          <article>
            <span>Projects saved</span>
            <strong>{savedProjects.length}</strong>
            <em>Private to your account</em>
          </article>
          <article>
            <span>Render queue</span>
            <strong>
              {
                savedProjects.filter((p) =>
                  ["generating", "rendering"].includes(p.status),
                ).length
              }
            </strong>
            <em className="live">● Live status</em>
          </article>
        </div>
        <div className="sectionHead">
          <div>
            <h2>Recent projects</h2>
            <p>
              {empty
                ? "Create your first project — samples shown below"
                : "Continue where you left off"}
            </p>
          </div>
          <button className="ghost">View all</button>
        </div>
        <div className="projectGrid">
          {projects.map((project, index) => {
            const progress = progressByStatus[project.status] ?? 10;
            const type =
              project.kind === "music_video" ? "Music video" : "Short film";
            return (
              <article className="project" key={project.id}>
                <div className={`poster ${index % 2 ? "blue" : "violet"}`}>
                  <div className="frameLines" />
                  <span className="projectType">
                    {type}
                    {empty ? " · SAMPLE" : ""}
                  </span>
                  <Link
                    aria-label={`Open ${project.title}`}
                    className="play"
                    href={
                      empty
                        ? `/create?mode=${project.kind === "music_video" ? "music-video" : "film"}`
                        : `/create?project=${project.id}`
                    }
                  >
                    ▶
                  </Link>
                </div>
                <div className="projectInfo">
                  <div className="projectTop">
                    <div>
                      <h3>{project.title}</h3>
                      <p>
                        {project.status.replaceAll("_", " ")} ·{" "}
                        {new Date(project.updated_at).toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <button aria-label="Project menu" className="dots">
                      •••
                    </button>
                  </div>
                  <div className="progressMeta">
                    <span>
                      {progress === 100
                        ? "Ready to export"
                        : "Production progress"}
                    </span>
                    <b>{progress}%</b>
                  </div>
                  <div className="progress">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="startRow">
          <article className="startCard">
            <span className="icon">🎬</span>
            <div>
              <h3>Start a short film</h3>
              <p>
                Turn one idea into a script, consistent cast and editable
                scenes.
              </p>
            </div>
            <Link href="/create?mode=film">Create film →</Link>
          </article>
          <article className="startCard">
            <span className="icon">♫</span>
            <div>
              <h3>Build a music video</h3>
              <p>
                Upload your song, map its structure and direct every visual
                beat.
              </p>
            </div>
            <Link href="/create?mode=music-video">Upload song →</Link>
          </article>
        </div>
        <footer className="appCopyright">
          © 2026 PixenarMV. All rights reserved.
        </footer>
      </section>
    </main>
  );
}
