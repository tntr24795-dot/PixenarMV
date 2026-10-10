/**
 * Pure resumable production-state reducer. No provider calls, billing or DB writes.
 * Persist the returned manifest in an authenticated project store when that
 * integration is implemented. Only a verified render may mark a shot succeeded.
 */
export type ShotState="pending"|"queued"|"rendering"|"succeeded"|"failed";
export type ShotRecord={id:string;chapterIndex:number;position:number;startSeconds:number;durationSeconds:number;status:ShotState;generationId?:string;outputPath?:string;attempts:number};
export type ProductionManifest={version:1;projectId:string;targetSeconds:number;shots:ShotRecord[]};
export function inspectProduction(manifest:ProductionManifest){
 if(manifest.version!==1||!manifest.projectId||!Number.isSafeInteger(manifest.targetSeconds)||manifest.targetSeconds<=0) throw new Error("Invalid manifest");
 const ids=new Set<string>();let cursor=0;
 for(const shot of manifest.shots){
  if(ids.has(shot.id)||shot.position!==ids.size||shot.startSeconds!==cursor||!Number.isSafeInteger(shot.durationSeconds)||shot.durationSeconds<=0) throw new Error("Invalid shot timeline");
  if(shot.status==="succeeded"&&(!shot.generationId||!shot.outputPath)) throw new Error("Completed shot has no verified output");
  ids.add(shot.id);cursor+=shot.durationSeconds;
 }
 if(cursor!==manifest.targetSeconds) throw new Error("Incomplete shot timeline");
 const done=manifest.shots.filter(s=>s.status==="succeeded").length;
 return {total:manifest.shots.length,completed:done,remaining:manifest.shots.length-done,secondsCompleted:manifest.shots.filter(s=>s.status==="succeeded").reduce((sum,s)=>sum+s.durationSeconds,0),readyForExport:done===manifest.shots.length && done>0};
}
export function resumeCandidates(manifest:ProductionManifest,limit=10){
 inspectProduction(manifest);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100) throw new Error("Invalid batch size");
 // Never automatically retry failed or active shots; reconciliation must query provider status.
 return manifest.shots.filter(s=>s.status==="pending").slice(0,limit);
}

/** Builds exact-duration shot placeholders, grouped by planned 5-minute chapter. */
export function createShotManifest(projectId:string,chapters:ReadonlyArray<{index:number;startSeconds:number;durationSeconds:number}>,shotSeconds=30):ProductionManifest{
 if(!projectId||!Number.isSafeInteger(shotSeconds)||shotSeconds<2||shotSeconds>30) throw new Error("Invalid production configuration");
 const shots:ShotRecord[]=[];let cursor=0;
 for(const chapter of chapters){
  if(chapter.startSeconds!==cursor||!Number.isSafeInteger(chapter.durationSeconds)||chapter.durationSeconds<=0) throw new Error("Invalid chapter timeline");
  const end=cursor+chapter.durationSeconds;
  while(cursor<end){const seconds=Math.min(shotSeconds,end-cursor);
   shots.push({id:`shot-${shots.length+1}`,chapterIndex:chapter.index,position:shots.length,startSeconds:cursor,durationSeconds:seconds,status:"pending",attempts:0});
   cursor+=seconds;
  }
 }
 const manifest:ProductionManifest={version:1,projectId,targetSeconds:cursor,shots};inspectProduction(manifest);return manifest;
}
