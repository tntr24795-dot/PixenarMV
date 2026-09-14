import Link from "next/link";
import { mainSiteUrl } from "@/lib/brand-links";

const workflow = [
  {
    n: "01",
    icon: "⇧",
    title: "Start with your story",
    body: "Upload a finished track for a full music video, or describe a film idea in one sentence.",
    meta: "MP3 · WAV · M4A · FLAC · TEXT",
  },
  {
    n: "02",
    icon: "▦",
    title: "Build the creative blueprint",
    body: "AI maps song sections or story beats, then prepares an editable script, cast and storyboard.",
    meta: "SCRIPT · CAST · SHOT LIST",
  },
  {
    n: "03",
    icon: "✦",
    title: "Direct every scene",
    body: "Choose Auto Director or select a PixenarAI model for each shot. Regenerate only what needs work.",
    meta: "SCENE-LEVEL MODEL CONTROL",
  },
  {
    n: "04",
    icon: "▶",
    title: "Review, render and export",
    body: "Edit timing on the timeline, check continuity and export for YouTube, film or social platforms.",
    meta: "16:9 · 9:16 · 720P · 1080P",
  },
];
const modelNames = [
  "Veo 3.1 Fast",
  "WAN 3.1",
  "Gemini Omni Flash",
  "Runway 4.5",
  "Seedance 2.0",
  "Seedance 2.5",
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="landingNav">
        <Link href="/" className="brand">
          <span className="brandMark">P</span>
          <span>
            Pixenar <b>MV</b>
          </span>
        </Link>
        <div className="landingLinks">
          <a href={mainSiteUrl}>Main website</a>
          <a href="#workflow">How it works</a>
          <a href="#continuity">Characters</a>
          <a href="#models">Models</a>
        </div>
        <Link className="navCta" href="/create">
          Create
        </Link>
      </nav>
      <section className="hero">
        <div className="heroGlow" />
        <p className="landingKicker">AI MOVIE & FULL-SONG MUSIC VIDEO STUDIO</p>
        <h1>
          Turn every story
          <br />
          into <span>cinema.</span>
        </h1>
        <p className="heroCopy">
          Upload a track or begin with one idea. PixenarMV builds the script,
          cast and scenes—then gives you control before the final render.
        </p>
        <div className="heroActions">
          <Link className="landingPrimary" href="/create?mode=music-video">
            Create a Music Video <span>›</span>
          </Link>
          <Link className="landingSecondary" href="/create?mode=film">
            Create a Short Film <span>›</span>
          </Link>
        </div>
        <div className="trust">
          <span>✓ Full-song workflow</span>
          <span>✓ Character continuity</span>
          <span>✓ Multi-model control</span>
          <span>✓ 16:9 + 9:16</span>
        </div>
        <div className="productWindow">
          <div className="windowBar">
            <i />
            <i />
            <i />
            <span>42 / 48 ready</span>
          </div>
          <div className="windowBody">
            <aside>
              <b>Storyboard</b>
              {[1, 2, 3, 4].map((n) => (
                <div
                  className={n === 2 ? "miniScene active" : "miniScene"}
                  key={n}
                >
                  <span>{n}</span>
                  <small>
                    Scene {n}
                    <br />
                    {n === 2 ? "Generating" : "Ready"}
                  </small>
                </div>
              ))}
            </aside>
            <div className="windowViewer">
              <div className="cinemaScene">
                <span className="rain" />
                <div className="character one" />
                <div className="character two" />
                <b>SCENE 02 · RAINY NIGHT</b>
              </div>
              <div className="fakeTimeline">
                {[28, 18, 30, 24].map((w, n) => (
                  <i style={{ width: `${w}%` }} key={n} />
                ))}
              </div>
            </div>
            <div className="windowInspector">
              <small>MODEL</small>
              <b>Auto Director</b>
              <small>CHARACTER LOCK</small>
              <b>2 references</b>
              <button>Generate scene</button>
            </div>
          </div>
        </div>
      </section>
      <section className="choice">
        <p className="landingKicker">TWO WAYS TO CREATE</p>
        <h2>One studio. Two complete workflows.</h2>
        <div className="choiceGrid">
          <article>
            <span className="choiceIcon">♫</span>
            <small>FULL-SONG PRODUCTION</small>
            <h3>Music Video</h3>
            <p>
              Analyze the structure of your song, map scenes to every section
              and keep the artist consistent from intro to final chorus.
            </p>
            <ul>
              <li>Beat and section mapping</li>
              <li>Storyline, performance and anime modes</li>
              <li>Original master track preserved</li>
            </ul>
            <Link href="/create?mode=music-video">Upload your song →</Link>
          </article>
          <article>
            <span className="choiceIcon">🎬</span>
            <small>AI FILMMAKING</small>
            <h3>Short Film</h3>
            <p>
              Turn a premise into an editable script, recurring cast, dialogue
              and cinematic scenes without needing a production crew.
            </p>
            <ul>
              <li>AI script and scene breakdown</li>
              <li>Dialogue, voices and shot direction</li>
              <li>Genre and visual-style controls</li>
            </ul>
            <Link href="/create?mode=film">Start your film →</Link>
          </article>
        </div>
      </section>
      <section className="workflow" id="workflow">
        <p className="landingKicker">ONE CONNECTED WORKFLOW</p>
        <h2>From first idea to complete visual story.</h2>
        <p className="sectionCopy">
          Pixenar handles the technical work while every creative decision stays
          editable.
        </p>
        <div className="workflowGrid">
          {workflow.map((item) => (
            <article key={item.n}>
              <span className="stepNum">{item.n}</span>
              <span className="stepIcon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <small>{item.meta}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="continuity" id="continuity">
        <div>
          <p className="landingKicker">CHARACTER CONTINUITY</p>
          <h2>
            Keep every character recognizable from first frame to final scene.
          </h2>
          <p className="sectionCopy">
            Create private character profiles from approved references. Lock
            identity, wardrobe, palette and locations across any range of
            scenes.
          </p>
          <ul>
            <li>
              <b>Reusable character profiles</b>
              <span>
                Save approved reference angles once and use them across
                projects.
              </span>
            </li>
            <li>
              <b>Continuity locks</b>
              <span>
                Keep identity, clothing, weather and locations aligned.
              </span>
            </li>
            <li>
              <b>Version-by-version review</b>
              <span>Compare generations without losing a successful shot.</span>
            </li>
          </ul>
          <Link className="landingSecondary inline" href="/characters">
            Build your first character ›
          </Link>
        </div>
        <div className="characterCard">
          <div className="portrait">
            <span />
            <span />
            <span />
          </div>
          <div className="lockRow">
            <b>ARIA · LEAD</b>
            <em>Identity locked</em>
          </div>
          <div className="referenceStrip">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
      <section className="models" id="models">
        <div>
          <p className="landingKicker">PIXENARAI MODEL CLOUD</p>
          <h2>Use the right model for every shot.</h2>
          <p className="sectionCopy">
            Let Auto Director balance quality, motion, duration and credits—or
            select a model manually scene by scene.
          </p>
        </div>
        <div className="modelCloud">
          {modelNames.map((name, n) => (
            <span key={name} className={n === 5 ? "featured" : ""}>
              {name}
              {n === 5 ? <small>UP TO 30S</small> : null}
            </span>
          ))}
        </div>
      </section>
      <section className="finalCta">
        <p className="landingKicker">YOUR NEXT STORY STARTS HERE</p>
        <h2>
          Direct the whole vision.
          <br />
          Keep control of every scene.
        </h2>
        <div>
          <Link className="landingPrimary" href="/create">
            Create your first project ›
          </Link>
          <Link className="landingSecondary inline" href="/studio">
            Open your studio
          </Link>
        </div>
      </section>
      <footer>
        <a href={mainSiteUrl} className="brand">
          <span className="brandMark">P</span>
          <span>
            Pixenar <b>MV</b>
          </span>
        </a>
        <p>AI filmmaking for creators, musicians and storytellers.</p>
        <span>© 2026 PixenarMV. All rights reserved.</span>
      </footer>
    </main>
  );
}
