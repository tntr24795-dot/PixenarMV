"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ShowcaseTemplate } from "@/lib/showcase";

export default function ShowcaseCarousel({items}:{items:ShowcaseTemplate[]}) {
  const [active,setActive]=useState<ShowcaseTemplate|null>(null);
  const railRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const id=window.setInterval(()=>{
      const rail=railRef.current;
      if(!rail) return;
      const card=rail.querySelector<HTMLElement>(".showcaseCard");
      const step=(card?.offsetWidth ?? 360)+18;
      const max=rail.scrollWidth-rail.clientWidth;
      const next=rail.scrollLeft+step>=max-4 ? 0 : rail.scrollLeft+step;
      rail.scrollTo({left:next,behavior:"smooth"});
    },6000);
    return ()=>window.clearInterval(id);
  },[]);

  async function copyPrompt(prompt:string){
    await navigator.clipboard.writeText(prompt);
  }

  return (
    <>
      <div className="showcaseRail" ref={railRef}>
        {items.map((item)=>(
          <article className="showcaseCard" key={item.slug}>
            <button className="showcaseMedia" onClick={()=>setActive(item)} aria-label={`Open ${item.title}`}>
              {item.videoSrc ? (
                <video src={item.videoSrc} muted playsInline preload="metadata" />
              ) : (
                <span className="showcasePlaceholder" aria-hidden="true">
                  <i />
                  <b>{item.category}</b>
                </span>
              )}
              <span className="showcaseWatermark">PixenarMV</span>
              <span className="showcasePlay">▶</span>
            </button>
            <div className="showcaseMeta">
              <div>
                <small>{item.category}</small>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <button onClick={()=>setActive(item)}>View prompt</button>
            </div>
          </article>
        ))}
      </div>

      {active ? (
        <div className="showcaseModal" role="dialog" aria-modal="true" aria-label={active.title}>
          <button className="showcaseBackdrop" onClick={()=>setActive(null)} aria-label="Close" />
          <div className="showcaseDialog">
            <button className="showcaseClose" onClick={()=>setActive(null)}>×</button>
            <div className="showcaseDialogMedia">
              {active.videoSrc ? (
                <video src={active.videoSrc} controls autoPlay muted playsInline />
              ) : (
                <span className="showcasePlaceholder large"><i /><b>Preview slot ready</b></span>
              )}
              <span className="showcaseWatermark large">PixenarMV</span>
            </div>
            <div className="showcaseDialogBody">
              <small>{active.category} · {active.aspectRatio} · {active.durationSeconds}s</small>
              <h3>{active.title}</h3>
              <p>{active.description}</p>
              <label>
                Prompt
                <textarea readOnly value={active.prompt} />
              </label>
              <div className="showcaseActions">
                <Link href={`/create?mode=film&template=${encodeURIComponent(active.slug)}`}>Use this prompt</Link>
                <button onClick={()=>copyPrompt(active.prompt)}>Copy prompt</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
