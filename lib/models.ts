export type VideoModel = {
  id: string; name: string; provider: string; credits: number;
  durations: number[]; badge: string; available: boolean; bestFor: string;
};

export const videoModels: VideoModel[] = [
  // Keep unconfigured providers visible in the catalogue, but never let a member
  // reserve credits for a provider that has no server-side adapter yet.
  { id:"veo-3-1-fast", name:"Veo 3.1 Fast", provider:"Google", credits:3, durations:[8], badge:"Provider setup", available:false, bestFor:"Hero scenes, realism and native audio" },
  { id:"wan-3-1", name:"WAN 3.1", provider:"Pixenar", credits:2, durations:[5,10], badge:"Provider setup", available:false, bestFor:"Drafts and high-volume scene generation" },
  { id:"wan-3-1-prime", name:"WAN 3.1 Prime", provider:"Pixenar", credits:2, durations:[5,10], badge:"Paused", available:false, bestFor:"Premium motion and detail" },
  { id:"gemini-omni-flash", name:"Gemini Omni Flash", provider:"Google", credits:2, durations:[8], badge:"Provider setup", available:false, bestFor:"Fast general-purpose scenes" },
  { id:"runway-4-5", name:"Runway 4.5", provider:"Runway", credits:2, durations:[6,8,10], badge:"Director control", available:true, bestFor:"Prompt adherence and controlled motion" },
  { id:"seedance-2-0", name:"Seedance 2.0", provider:"Seedance", credits:5, durations:[8,10,15], badge:"Provider setup", available:false, bestFor:"Reliable standard-length scenes" },
  { id:"seedance-2-5", name:"Seedance 2.5", provider:"Seedance", credits:6, durations:[8,10,15,20,25,30], badge:"Provider setup", available:false, bestFor:"Long-form shots up to 30 seconds" },
];

export function creditsFor(modelId:string, duration:number){
  if(modelId === "seedance-2-0") return duration === 15 ? 9 : 5;
  if(modelId === "seedance-2-5") return ({8:6,10:6,15:10,20:15,25:20,30:25} as Record<number,number>)[duration] ?? 6;
  return videoModels.find((model)=>model.id===modelId)?.credits ?? 0;
}
