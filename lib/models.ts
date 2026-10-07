import { quoteVideo } from "./pricing";
export type VideoModel = {
  id: string; name: string; provider: string; credits: number;
  durations: number[]; badge: string; available: boolean; bestFor: string; resolutions?: string[];
};

export const videoModels: VideoModel[] = [
  // Keep unconfigured providers visible in the catalogue, but never let a member
  // reserve credits for a provider that has no server-side adapter yet.
  { id:"veo-3-1-fast", name:"Veo 3.1 Fast", provider:"Google", credits:3, durations:[8], badge:"Provider setup", available:false, bestFor:"Hero scenes, realism and native audio" },
  { id:"wan-3-0", name:"Wan 3.0 Standard", provider:"Runway", credits:10, durations:Array.from({length:29},(_,i)=>i+2), badge:"Single generation · up to 30s", available:true, bestFor:"Native audio and affordable 30-second videos", resolutions:["480p","720p","1080p"] },
  { id:"wan-3-0-prime", name:"Wan 3.0 Prime", provider:"Runway", credits:16, durations:Array.from({length:29},(_,i)=>i+2), badge:"Faster generation", available:true, bestFor:"Accelerated 30-second video generation", resolutions:["480p","720p","1080p"] },
  { id:"gemini-omni-flash", name:"Gemini Omni Flash", provider:"Google", credits:2, durations:[8], badge:"Provider setup", available:false, bestFor:"Fast general-purpose scenes" },
  { id:"runway-4-5", name:"Runway 4.5", provider:"Runway", credits:14, durations:[6,8,10], badge:"Director control", available:true, bestFor:"Prompt adherence and controlled motion", resolutions:["720p"] },
  { id:"seedance-2-0", name:"Seedance 2.0", provider:"Seedance", credits:5, durations:[8,10,15], badge:"Provider setup", available:false, bestFor:"Reliable standard-length scenes" },
  { id:"seedance-2-5", name:"Seedance 2.5", provider:"Seedance", credits:6, durations:[8,10,15,20,25,30], badge:"Provider setup", available:false, bestFor:"Long-form shots up to 30 seconds" },
];

for (const model of videoModels.filter(m => m.available)) model.credits = quoteVideo(model.id,model.durations[0],model.resolutions?.[0] || "720p").credits / model.durations[0];

export function creditsFor(modelId:string, duration:number, resolution = "720p") {
  try { return quoteVideo(modelId, duration, resolution).credits; }
  catch { return 0; } // Unpriced catalogue entries cannot generate.
}
