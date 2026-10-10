import {longDramaSegments,estimateLongDrama} from "./long-drama";

export type LongDramaChapter={
 index:number; startSeconds:number; endSeconds:number; durationSeconds:number;
 title:string; narrativeGoal:string; continuityReminder:string; status:"planned";
};

/** Creates a deterministic, complete chapter timeline without generating media or billing users. */
export function createLongDramaOutline(input:{
 minutes:number; premise:string; modelId:string; resolution:string;
}) {
 const premise=input.premise.trim();
 if(premise.length<40||premise.length>6000) throw new Error("A premise of 40–6,000 characters is required.");
 const estimate=estimateLongDrama(input.minutes,input.modelId,input.resolution);
 const beats=longDramaSegments(input.minutes);
 const chapters:LongDramaChapter[]=beats.map((beat,index)=>({
  ...beat,
  title:`Chapter ${index+1} of ${beats.length}`,
  narrativeGoal:index===0?"Introduce the central conflict and recurring characters.":index===beats.length-1?"Resolve the main conflict and establish the ending.":"Advance the story logically from the previous chapter while preserving established facts.",
  continuityReminder:"Keep cast identity, chronology, costumes, dialogue voice and location consistent unless the story explicitly calls for changes.",
  status:"planned"
 }));
 if(chapters[0].startSeconds!==0||chapters.at(-1)?.endSeconds!==input.minutes*60) throw new Error("Incomplete timeline.");
 return {version:1,status:"planning_only" as const,premise,minutes:input.minutes,modelId:input.modelId,resolution:input.resolution,estimate,chapters,
   note:"Chapter plans are metadata, not generated film. Rendering, audio synchronization and final export are not available in this workflow."};
}
