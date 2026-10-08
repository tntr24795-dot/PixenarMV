"use client";

import Link from "next/link";
import { useState } from "react";
import { annualSavingsUsd, subscriptionPlans, type SubscriptionPlanId } from "@/lib/plans";
import { creditPacks } from "@/lib/pricing";

type Tab = "monthly" | "annual" | "credits";
const planIds = Object.keys(subscriptionPlans) as SubscriptionPlanId[];

export default function PricingSelector() {
  const [tab,setTab]=useState<Tab>("monthly");
  return (
    <div className="pricingExperience">
      <div className="pricingTabs" role="tablist" aria-label="Pricing options">
        <button className={tab==="monthly"?"active":""} onClick={()=>setTab("monthly")}>Monthly</button>
        <button className={tab==="annual"?"active":""} onClick={()=>setTab("annual")}>Annual <span>Save up to $189</span></button>
        <button className={tab==="credits"?"active":""} onClick={()=>setTab("credits")}>Buy Credits</button>
      </div>

      {tab!=="credits" ? (
        <>
          <div className="billingNote">
            <b>{tab==="monthly" ? "Pay month to month" : "Pay once for the year"}</b>
            <span>{tab==="monthly" ? "Credits refresh each monthly cycle." : "Annual plans include the same monthly credit allowance, annual-term rollover, and a first-cycle bonus."}</span>
          </div>
          <div className="planGrid">
            {planIds.map(planId=>{
              const plan=subscriptionPlans[planId];
              const featured=planId==="premium";
              const annual=tab==="annual";
              return (
                <article className={featured?"planCard featured":"planCard"} key={planId}>
                  {featured?<span className="bestBadge">MOST POPULAR</span>:null}
                  <header>
                    <div>
                      <small>{plan.name.toUpperCase()}</small>
                      <h2>{plan.monthlyCredits.toLocaleString()} <span>credits / month</span></h2>
                    </div>
                  </header>
                  <div className="planPrice">
                    <strong>{annual ? "$" + plan.annualPriceUsd : "$" + plan.monthlyPriceUsd}</strong>
                    <span>{annual?"/ year":"/ month"}</span>
                  </div>
                  {annual ? (
                    <div className="annualCallout">
                      <b>Save {"$" + annualSavingsUsd(planId)}</b>
                      <span>vs. paying monthly for 12 months</span>
                    </div>
                  ) : (
                    <div className="annualCallout neutral">
                      <b>{"$" + plan.annualPriceUsd}/year available</b>
                      <span>Switch to Annual above to compare savings</span>
                    </div>
                  )}
                  <ul>
                    <li>{plan.monthlyCredits.toLocaleString()} credits every month</li>
                    <li>Access to available Pixenar video models</li>
                    <li>Short Film, Drama & Music Video workflows</li>
                    <li>Dynamic credit estimate before Generate</li>
                    {annual ? <li>+{plan.annualFirstCycleBonusCredits} bonus credits in first annual cycle</li> : <li>Cancel or change plan at the next billing cycle</li>}
                  </ul>
                  <Link href="/login" className={featured?"planButton primary":"planButton"}>
                    Choose {plan.name}
                  </Link>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="creditSection">
          <div className="creditIntro">
            <div>
              <small>TOP-UP CREDITS</small>
              <h2>Need more credits without changing your plan?</h2>
            </div>
            <p>Buy additional credits whenever you need them. Your subscription stays the same.</p>
          </div>
          <div className="creditGrid">
            {creditPacks.map((pack,index)=>(
              <article className={index===2?"creditCard featured":"creditCard"} key={pack.credits}>
                {index===2?<span className="creditBadge">POPULAR TOP-UP</span>:null}
                <small>CREDIT PACK</small>
                <h3>{pack.credits.toLocaleString()} credits</h3>
                <div><strong>{"$" + pack.dollars.toFixed(2)}</strong><span>one-time</span></div>
                <p>{"$" + (pack.dollars/pack.credits).toFixed(4)} per credit</p>
                <Link href="/login" className="planButton">Buy credits</Link>
              </article>
            ))}
          </div>
          <div className="creditInfo">
            <b>How top-ups work</b>
            <span>Top-up credits are separate from your subscription allowance. Generation costs still vary by model, duration, resolution and reference inputs, and the exact estimate is shown before you generate.</span>
          </div>
        </div>
      )}
    </div>
  );
}
