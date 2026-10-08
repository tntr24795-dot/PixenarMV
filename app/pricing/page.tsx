import "./pricing.css";
import Link from "next/link";
import PricingSelector from "@/components/pricing-selector";
import { mainSiteUrl } from "@/lib/brand-links";

export default function PricingPage() {
  return (
    <main className="pricingPage">
      <nav className="pricingNav">
        <Link href="/" className="brand">
          <span className="brandMark">P</span>
          <span>Pixenar <b>Studio</b></span>
        </Link>
        <div>
          <Link href="/">Home</Link>
          <a href={mainSiteUrl}>Main website</a>
          <Link href="/create">Create</Link>
        </div>
      </nav>
      <section className="pricingHero">
        <p>PIXENAR STUDIO PRICING</p>
        <h1>Simple plans. Clear credits.</h1>
        <span>Choose monthly, annual, or buy extra credits whenever you need more production capacity.</span>
      </section>
      <PricingSelector />
      <section className="pricingHelp"><article><b>AI Long Drama — up to 1 hour</b><span>Explore estimated credits for 30–60 minute productions. Full-length generation is in development; no credits are charged by the estimator. <a href="/long-drama">View credit estimates</a></span></article>
        <article><b>Credits are usage-based</b><span>Video generation cost changes by model, duration, resolution and reference inputs.</span></article>
        <article><b>See the price before Generate</b><span>Pixenar Studio calculates the estimated credit cost before each generation.</span></article>
        <article><b>Top up without upgrading</b><span>Extra credit packs can be purchased without changing your subscription plan.</span></article>
      </section>
    </main>
  );
}
