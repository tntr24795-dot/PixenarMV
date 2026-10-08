"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ShowcaseTemplate } from "@/lib/showcase";

export default function ShowcaseCarousel({items}:{items:ShowcaseTemplate[]}) {
  const [active,setActive]=useState<ShowcaseTemplate|null>(null);
  const railRef=useRef<HTMLDivElement>(null);
  const videoRefs=useRef(new Map<string,HTMLVideoElement>());

  useEffect(()=>{
    const rail=railRef.current;
    if(!rail) return;
    const observer=new IntersectionObserver((entries)=>{
      for(const entry of entries){
        const video=entry.target.querySelector<HTMLVideoElement>("video");
        if(!video) continue;
        if(entry.isIntersecting && entry.intersectionRatio>=0.65){
          video.play().catch(()=>undefined);
        }else{
          video.pause();
        }
      }
    },{root:rail,threshold:[0,.65,1]});
    const cards=Array.from(rail.querySelectorAll<HTMLElement>(".showcaseCard"));
    cards.forEach((card)=>observer.observe(card));
    return ()=>observer.disconnect();
  },[items]);

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
                <video ref={(node)=>{if(node) videoRefs.current.set(item.slug,node); else videoRefs.current.delete(item.slug)}} src={item.videoSrc} poster={item.thumbnailSrc} muted loop playsInline preload="metadata" />
              ) : (
                <span className={`showcasePlaceholder showcaseVisual theme-${item.category.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} aria-hidden="true">
                  <span className="visualScene" />
                  <span className="visualSubject one" />
                  <span className="visualSubject two" />
                  <i />
                  <b>{item.title}</b>
                  <small>{item.category} · {item.aspectRatio} · visual concept</small>
                </span>
              )}
              <span className="showcaseWatermark">Pixenar Studio</span>
              <span className="showcasePlay">▶</span>
            </button>
            <div className="showcaseMeta">
              <div>
                <small>{item.category} · {item.modelId} · {item.durationSeconds}s</small>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <p className="showcasePromptPreview"><b>Prompt:</b> {item.prompt}</p>
                {!item.videoSrc ? <p className="showcaseMediaStatus">Preview video pending upload · prompt is ready to use now</p> : null}
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
                <video src={active.videoSrc} poster={active.thumbnailSrc} controls autoPlay muted loop playsInline />
              ) : (
                <span className="showcasePlaceholder large"><i /><b>{active.title}</b><small>Preview media has not been uploaded yet</small></span>
              )}
              <span className="showcaseWatermark large">Pixenar Studio</span>
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
