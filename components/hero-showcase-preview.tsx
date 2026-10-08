"use client";

import { useEffect, useMemo, useState } from "react";
import type { ShowcaseTemplate } from "@/lib/showcase";

export default function HeroShowcasePreview({items}:{items:ShowcaseTemplate[]}) {
  const videos=useMemo(()=>items.filter((item)=>item.videoSrc),[items]);
  const [index,setIndex]=useState(0);

  useEffect(()=>{
    if(videos.length<2) return;
    const id=window.setInterval(()=>setIndex((value)=>(value+1)%videos.length),10000);
    return ()=>window.clearInterval(id);
  },[videos.length]);

  const active=videos[index] ?? items[0];
  if(!active) return null;

  const promptParts=[
    active.prompt,
    active.style ? `Style: ${active.style}` : `${active.category} cinematic direction`,
    `${active.aspectRatio} · ${active.durationSeconds}s · ${active.modelId}`,
  ];

  return (
    <div className="windowViewer">
      <div className="cinemaScene realPreview">
        {active.videoSrc ? (
          <video key={active.slug} src={active.videoSrc} autoPlay muted loop playsInline preload="metadata" />
        ) : null}
        <b>{active.title.toUpperCase()}</b>
      </div>
      <div className="promptExamples" aria-label="Example scene prompt">
        {promptParts.map((text,n)=><span key={n}>{n===0?"🎬":n===1?"◉":"✦"} {text}</span>)}
      </div>
      <div className="previewDots" aria-label="Showcase preview position">
        {videos.map((item,n)=>(
          <button
            type="button"
            key={item.slug}
            className={n===index?"active":""}
            onClick={()=>setIndex(n)}
            aria-label={`Show ${item.title}`}
          />
        ))}
      </div>
    </div>
  );
}
