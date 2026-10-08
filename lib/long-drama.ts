import {quoteVideo} from "./pricing";
import {videoModels} from "./models";

/**
 * Credit-only production estimate. Not a generation reservation.
 * Provider clips are always billed in supported durations, even when trimmed
 * in the finished edit. No synthetic frame interpolation is assumed.
 */
export function estimateLongDrama(minutes:number,modelId:string,resolution:string) {
 if(!Number.isInteger(minutes)||minutes<30||minutes>60) throw new Error("Length must be 30–60 minutes.");
 const model=videoModels.find(item=>item.id===modelId && item.available);
 if(!model?.resolutions?.includes(resolution)) throw new Error("Unsupported model or resolution.");
 const supported=[...model.durations].sort((a,b)=>b-a);
 if(!supported.length) throw new Error("Model has no supported clip durations.");
 const targetSeconds=minutes*60;
 const duration=supported[0];
 const fullClips=Math.floor(targetSeconds/duration);
 const remainder=targetSeconds%duration;
 const lastClip=remainder ? [...supported].reverse().find(s=>s>=remainder)??duration : 0;
 const fullClipCredits=quoteVideo(modelId,duration,resolution).credits;
 const quotedCredits=fullClips*fullClipCredits+(lastClip ? quoteVideo(modelId,lastClip,resolution).credits : 0);
 const renderSeconds=fullClips*duration+lastClip;
 return {minutes,targetSeconds,renderSeconds,clipCount:fullClips+Number(Boolean(lastClip)),
  estimatedVideoCredits:quotedCredits,modelId,resolution,
  disclaimer:"Video-only estimate, without failed retries, reference assets, voice, sound, assembly or export. Do not reserve or deduct credits based on this estimate."};
}

/** Metadata-only schedule for segmented production; no provider calls or charges. */
export function longDramaSegments(minutes:number, segmentMinutes=5) {
 if(!Number.isInteger(minutes)||minutes<30||minutes>60) throw new Error("Unsupported duration.");
 if(!Number.isInteger(segmentMinutes)||segmentMinutes<1||segmentMinutes>10) throw new Error("Unsupported segment size.");
 const result:{index:number;startSeconds:number;durationSeconds:number;endSeconds:number}[]=[];
 for(let start=0;start<minutes*60;start+=segmentMinutes*60){
   const end=Math.min(minutes*60,start+segmentMinutes*60);
   result.push({index:result.length,startSeconds:start,durationSeconds:end-start,endSeconds:end});
 }
 if(result.reduce((sum,s)=>sum+s.durationSeconds,0)!==minutes*60) throw new Error("Timeline mismatch.");
 return result;
}
