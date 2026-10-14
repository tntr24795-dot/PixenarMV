"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Item={
  slug:string; title:string; category:string; modelId:string; durationSeconds:number;
  videoSrc?:string; description?:string; prompt?:string;
};

const FILTERS=["All","Realistic","Anime","3D","Cinematic","Lifestyle","Fantasy"];

function matches(item:Item,filter:string){
  if(filter==="All") return true;
  const hay=`${item.category} ${item.title} ${item.description||""}`.toLowerCase();
  if(filter==="Realistic") return /(drama|romance|travel|lifestyle|commercial|real|product|car|skincare|coffee|beach|cafe|train|rain|town|mountain|desert)/.test(hay);
  if(filter==="Anime") return /anime/.test(hay);
  if(filter==="3D") return /3d|storybook|cyberpunk|fantasy|animation/.test(hay);
  if(filter==="Cinematic") return /cinematic|drama|commercial|travel|car|fantasy/.test(hay);
  if(filter==="Lifestyle") return /lifestyle|beach|cafe|coffee|skincare|mountain/.test(hay);
  if(filter==="Fantasy") return /fantasy|anime|storybook|cyberpunk/.test(hay);
  return true;
}

export default function MemberShowcaseGrid({items}:{items:Item[]}){
  const [active,setActive]=useState("All");
  const filtered=useMemo(()=>items.filter(item=>matches(item,active)),[items,active]);
  return (
    <section className="memberShowcase">
      <div className="memberShowcaseHead">
        <div>
          <h1>Showcase</h1>
          <p>Explore what&apos;s possible with Pixenar Studio. Click any video to use it as a reference.</p>
        </div>
        <div className="memberFilters">
          {FILTERS.map(filter=><button key={filter} className={active===filter?"active":""} onClick={()=>setActive(filter)}>{filter}</button>)}
        </div>
      </div>

      <div className="memberShowcaseGrid">
        {filtered.map((item,index)=>(
          <article className="memberShowcaseCard" key={item.slug}>
            <Link href={`/create?mode=film&template=${encodeURIComponent(item.slug)}`} className="memberShowcaseMedia">
              {item.videoSrc ? <video src={item.videoSrc} muted loop playsInline preload="metadata" onMouseEnter={e=>e.currentTarget.play().catch(()=>{})} onMouseLeave={e=>{e.currentTarget.pause();e.currentTarget.currentTime=0;}} /> : <span className="memberShowcaseFallback">Preview</span>}
              <span className="memberPlay">▶</span>
              <small>{String(item.durationSeconds).padStart(2,"0")}s</small>
            </Link>
            <div className="memberShowcaseInfo">
              <h3>{index+1}. {item.title}</h3>
              <div><span>{item.category}</span><span>{item.modelId}</span></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
