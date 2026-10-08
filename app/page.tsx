import Link from "next/link";
import { mainSiteUrl } from "@/lib/brand-links";
import { showcaseTemplates } from "@/lib/showcase";
import ShowcaseCarousel from "@/components/showcase-carousel";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/config";
import { annualSavingsUsd, subscriptionPlans, type SubscriptionPlanId } from "@/lib/plans";

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
const planIds = Object.keys(subscriptionPlans) as SubscriptionPlanId[];

const modelNames = [
  "Veo 3.1 Fast",
  "WAN 3.0",
  "Gemini Omni Flash",
  "Runway 4.5",
  "Grok Imagine Video 1.5",
  "Seedance 2.0",
  "Seedance 2.5",
];

export default async function Home() {
  const supabase = await createClient();
  const { data: publishedShowcase } = await supabase
    .from("showcase_videos")
    .select("slug,title,category,description,prompt,style,aspect_ratio,duration_seconds,model_id,video_path,thumbnail_path,is_featured,featured_order")
    .eq("published", true)
    .eq("is_featured", true)
    .order("featured_order", { ascending: true })
    .limit(30);
  const liveShowcase = (publishedShowcase ?? []).map((item) => ({
    slug: item.slug,
    title: item.title,
    category: item.category,
    description: item.description,
    prompt: item.prompt,
    style: item.style,
    aspectRatio: item.aspect_ratio === "9:16" ? "9:16" as const : "16:9" as const,
    durationSeconds: item.duration_seconds,
    modelId: item.model_id,
    videoSrc: item.video_path
      ? `${supabaseUrl}/storage/v1/object/public/showcase-media/${item.video_path.split("/").map(encodeURIComponent).join("/")}`
      : undefined,
    thumbnailSrc: item.thumbnail_path
      ? `${supabaseUrl}/storage/v1/object/public/showcase-media/${item.thumbnail_path.split("/").map(encodeURIComponent).join("/")}`
      : undefined,
  }));
  const showcaseItems = liveShowcase.length ? liveShowcase : showcaseTemplates;
  return (
    <main className="landing">
      <nav className="landingNav">
        <Link href="/" className="brand">
          <span className="brandMark">P</span>
          <span>
            Pixenar <b>Studio</b>
          </span>
        </Link>
        <div className="landingLinks">
          <a href={mainSiteUrl}>Main website</a>
          <a href="#workflow">How it works</a>
          <a href="#continuity">Characters</a>
          <a href="#models">Models</a>
          <a href="#pricing">Pricing</a>
        </div>
        <Link className="navCta" href="/create">
          Create
        </Link>
      </nav>
      <section className="hero">
        <div className="heroGlow" />
        <p className="landingKicker">AI FILM · DRAMA · MUSIC · VIDEO CREATION STUDIO</p>
        <h1>
          Turn every story
          <br />
          into <span>cinema.</span>
        </h1>
        <p className="heroCopy">
          Start with a story, song or concept. Pixenar Studio builds the script, cast, scenes and production flow—then gives you control before the final render.
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
        <div className="heroPricing" aria-label="Pixenar Studio pricing">
          {planIds.map((planId) => {
            const plan = subscriptionPlans[planId];
            return (
              <a href="#pricing" className={planId === "premium" ? "heroPriceCard featured" : "heroPriceCard"} key={planId}>
                <small>{plan.name}{planId === "premium" ? " · MOST POPULAR" : ""}</small>
                <b><strong>${plan.monthlyPriceUsd}</strong><span>/mo</span></b>
                <em>{plan.monthlyCredits.toLocaleString()} credits · ${plan.annualPriceUsd}/year</em>
              </a>
            );
          })}
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
      <section className="showcaseSection" id="examples">
        <div className="showcaseHead">
          <div>
            <p className="landingKicker">CREATE FROM AN EXAMPLE</p>
            <h2>See the idea. Open the prompt. Make it yours.</h2>
            <p className="sectionCopy">
              Explore ready-to-create film, drama, music video, animation and commercial concepts. Every card includes its prompt and settings. When a preview video has not been uploaded yet, Pixenar shows a visual concept card instead of an empty frame.
            </p>
          </div>
          <Link className="landingSecondary inline" href="/create?mode=film">
            Start from scratch
          </Link>
        </div>
        <ShowcaseCarousel items={showcaseItems} />
      </section>
      <section className="choice">
        <p className="landingKicker">MULTIPLE WAYS TO CREATE</p>
        <h2>One studio for stories, music and visual production.</h2>
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

      <section className="pricingSection" id="pricing">
        <div className="pricingHead">
          <p className="landingKicker">SIMPLE CREATOR PRICING</p>
          <h2>Choose the credits that fit your production pace.</h2>
          <p className="sectionCopy">
            Every plan includes access to available Pixenar Studio workflows and models. Credits are used dynamically based on the model, duration, resolution and references you choose.
          </p>
        </div>
        <div className="pricingGrid">
          {planIds.map((planId) => {
            const plan = subscriptionPlans[planId];
            const savings = annualSavingsUsd(planId);
            const featured = planId === "premium";
            return (
              <article className={featured ? "pricingCard featured" : "pricingCard"} key={planId}>
                {featured ? <span className="pricingBadge">MOST POPULAR</span> : null}
                <div className="pricingTitleRow">
                  <div>
                    <small>{plan.name.toUpperCase()}</small>
                    <h3>{plan.monthlyCredits.toLocaleString()} credits</h3>
                  </div>
                  <span>per month</span>
                </div>
                <div className="pricingPrice">
                  <strong>${plan.monthlyPriceUsd}</strong>
                  <span>/month</span>
                </div>
                <div className="pricingAnnual">
                  <b>${plan.annualPriceUsd}/year</b>
                  <span>Save ${savings} vs monthly</span>
                </div>
                <ul>
                  <li>{plan.monthlyCredits.toLocaleString()} credits each month</li>
                  <li>Access to available video models</li>
                  <li>Film, drama and music-video workflows</li>
                  <li>Dynamic reference pricing before Generate</li>
                  <li>{plan.annualRollover ? "Annual credits roll within the annual term" : "Monthly credits reset each cycle"}</li>
                </ul>
                <Link className={featured ? "landingPrimary pricingCta" : "landingSecondary pricingCta"} href="/login">
                  Choose {plan.name} <span>›</span>
                </Link>
              </article>
            );
          })}
        </div>
        <p className="pricingFootnote">
          Generation cost varies by model and settings. Pixenar Studio shows the exact estimated credit cost before you generate.
        </p>
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
            Pixenar <b>Studio</b>
          </span>
        </a>
        <p>AI creation for filmmakers, musicians, storytellers and brands.</p>
        <span>© 2026 Pixenar Studio. All rights reserved.</span>
      </footer>
    </main>
  );
}
