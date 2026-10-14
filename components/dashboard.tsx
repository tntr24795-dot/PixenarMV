import Link from "next/link";
import { mainSiteUrl } from "@/lib/brand-links";
import VideoLibrary, { type VideoLibraryItem } from "@/components/video-library";
import SignOutButton from "@/components/sign-out-button";
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
  videos = [],
}: {
  savedProjects?: SavedProject[];
  credits?: number;
  role?: "user" | "admin";
  videos?: VideoLibraryItem[];
}) {
  const empty = savedProjects.length === 0;
  const projects = empty ? samples : savedProjects;
  return (
    <main className="memberDash">
      <header className="memberTopbar">
        <Link className="memberBrand" href="/">
          <span className="memberBrandMark">P</span>
          <span>PIXENAR <b>STUDIO</b></span>
        </Link>
        <nav className="memberTopnav" aria-label="Studio sections">
          <Link className="active" href="/create">Create</Link>
          <Link href="/#examples">Showcase</Link>
          <a href="#videos">My Videos</a>
          <Link href="/characters">Characters</Link>
        </nav>
        <div className="memberTopActions">
          <span className="memberCredits">◉ <b>{credits.toLocaleString()}</b> credits</span>
          <button type="button" aria-label="Help">?</button>
          <button type="button" aria-label="Notifications">♢</button>
          <span className="memberAvatar">D</span>
        </div>
      </header>

      <aside className="memberSidebar">
        <nav>
          <Link className="memberSide active" href="/#examples"><span>▣</span>Showcase</Link>
          <Link className="memberSide" href="/create"><span>＋</span>Create</Link>
          <Link className="memberSide" href="/characters"><span>♙</span>Characters</Link>
          <a className="memberSide" href="#videos"><span>▤</span>My Videos</a>
        </nav>

        <div className="memberSideGroup">
          <small>AI TOOLS</small>
          <Link className="memberSide" href="/create?mode=film"><span>▧</span>Image to Video</Link>
          <Link className="memberSide" href="/create?mode=film"><span>▧</span>Video to Video</Link>
          <Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Short Drama</Link>
          <Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Long Drama</Link>
          <Link className="memberSide" href="/create?mode=music-video"><span>♫</span>Music Video</Link>
        </div>

        <div className="memberSideGroup">
          <small>LIBRARY</small>
          <Link className="memberSide" href="/#examples"><span>▧</span>Templates</Link>
          <a className="memberSide" href="#videos"><span>▱</span>Assets</a>
          <Link className="memberSide" href="/characters"><span>♩</span>Voices</Link>
        </div>

        {role === "admin" ? <Link className="memberSide memberAdmin" href="/admin/showcase"><span>▤</span>Admin</Link> : null}
      </aside>

      <section className="memberContent" id="projects">
        <header className="memberContentHead">
          <div>
            <h1>Your Studio {role === "admin" ? <span className="adminBadge">Admin</span> : null}</h1>
            <p>Manage projects, generated videos and your creative workflow.</p>
          </div>
          <Link className="memberNewButton" href="/create"><span>＋</span>New project</Link>
        </header>

        <div className="stats">
          <article><span>Active projects</span><strong>{savedProjects.filter((p)=>p.status!=="completed").length}</strong><em>Across film and music</em></article>
          <article><span>Projects saved</span><strong>{savedProjects.length}</strong><em>Private to your account</em></article>
          <article><span>Render queue</span><strong>{savedProjects.filter((p)=>["generating","rendering"].includes(p.status)).length}</strong><em className="live">● Live status</em></article>
        </div>

        <div className="sectionHead">
          <div><h2>Recent projects</h2><p>{empty ? "Create your first project — samples shown below" : "Continue where you left off"}</p></div>
          <span className="sectionCount">{savedProjects.length} saved</span>
        </div>

        <div className="projectGrid">
          {projects.map((project,index)=>{
            const progress=progressByStatus[project.status]??10;
            const type=project.kind==="music_video"?"Music video":"Short film";
            return (
              <article className="project" key={project.id}>
                <div className={`poster ${index%2?"blue":"violet"}`}>
                  <div className="frameLines" />
                  <span className="projectType">{type}{empty?" · SAMPLE":""}</span>
                  <Link aria-label={`Open ${project.title}`} className="play" href={empty?`/create?mode=${project.kind==="music_video"?"music-video":"film"}`:`/create?project=${project.id}`}>▶</Link>
                </div>
                <div className="projectInfo">
                  <div className="projectTop"><div><h3>{project.title}</h3><p>{project.status.replaceAll("_"," ")} · {new Date(project.updated_at).toLocaleDateString("en",{month:"short",day:"numeric"})}</p></div>
                    <Link className="dots" aria-label={`Open ${project.title}`} href={empty?"/create":`/create?project=${project.id}`}>Open</Link>
                  </div>
                  <div className="progressMeta"><span>{progress===100?"Ready to export":"Production progress"}</span><b>{progress}%</b></div>
                  <div className="progress"><i style={{width:`${progress}%`}} /></div>
                </div>
              </article>
            );
          })}
        </div>

        <div id="videos"><VideoLibrary items={videos} /></div>

        <div className="startRow">
          <article className="startCard"><span className="icon">🎬</span><div><h3>Start a short film</h3><p>Turn one idea into a script, consistent cast and editable scenes.</p></div><Link href="/create?mode=film">Create film →</Link></article>
          <article className="startCard"><span className="icon">♫</span><div><h3>Build a music video</h3><p>Upload your song, map its structure and direct every visual beat.</p></div><Link href="/create?mode=music-video">Upload song →</Link></article>
        </div>

        <div className="memberFooterActions">
          <a href={mainSiteUrl}>Main website</a>
          <SignOutButton />
        </div>
      </section>
    </main>
  );}
