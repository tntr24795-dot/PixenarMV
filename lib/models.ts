import { quoteVideo } from "./pricing";
export type VideoModel = {
  id: string; name: string; provider: string; credits: number;
  durations: number[]; badge: string; available: boolean; bestFor: string; resolutions?: string[];
};

const range = (start:number, end:number) => Array.from({length:end-start+1},(_,i)=>i+start);

export const videoModels: VideoModel[] = [
  // Keep unconfigured providers visible in the catalogue, but never let a member
  // reserve credits for a provider that has no server-side adapter yet.
  { id:"veo-3-1-fast", name:"Veo 3.1 Fast", provider:"Google", credits:3, durations:[8], badge:"Provider setup", available:false, bestFor:"Hero scenes, realism and native audio" },
  { id:"wan-3-0", name:"WAN 3.0 Standard", provider:"Runway", credits:10, durations:range(2,30), badge:"Native audio · up to 30s", available:true, bestFor:"Reference-driven scenes, native audio and flexible 2–30 second shots", resolutions:["480p","720p","1080p"] },
  { id:"wan-3-0-prime", name:"WAN 3.0 Prime", provider:"Runway", credits:16, durations:range(2,30), badge:"High-speed WAN 3.0", available:true, bestFor:"Faster WAN generation with native audio", resolutions:["480p","720p","1080p"] },
  { id:"grok-imagine-1-5", name:"Grok Imagine Video 1.5", provider:"Runway / xAI", credits:10, durations:range(1,15), badge:"Native audio · up to 15s", available:true, bestFor:"Fast cinematic video, native audio and reference-driven performance", resolutions:["480p","720p","1080p"] },
  { id:"gemini-omni-flash", name:"Gemini Omni Flash", provider:"Google", credits:2, durations:[8], badge:"Provider setup", available:false, bestFor:"Fast general-purpose scenes" },
  { id:"runway-4-5", name:"Runway 4.5", provider:"Runway", credits:14, durations:[6,8,10], badge:"Director control", available:true, bestFor:"Prompt adherence and controlled motion", resolutions:["720p"] },
  { id:"seedance-2-0", name:"Seedance 2.0", provider:"Runway / ByteDance", credits:36, durations:range(4,15), badge:"Cinematic · 4–15s", available:true, bestFor:"High-quality cinematic generation with fine-grained duration and audio control", resolutions:["480p","720p","1080p"] },
  { id:"seedance-2-5", name:"Seedance 2.5", provider:"Runway / ByteDance", credits:20, durations:range(4,30), badge:"Cinematic · up to 30s", available:true, bestFor:"Long cinematic shots and large multimodal reference budgets", resolutions:["480p","720p","1080p"] },
];

for (const model of videoModels.filter(m => m.available)) model.credits = quoteVideo(model.id,model.durations[0],model.resolutions?.[0] || "720p").credits / model.durations[0];

export function creditsFor(modelId:string, duration:number, resolution = "720p", references = {}) {
  try { return quoteVideo(modelId, duration, resolution, references).credits; }
  catch { return 0; } // Unpriced catalogue entries cannot generate.
}
