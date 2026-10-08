// Budget assumptions, not a claim about actual invoices. See pricing documentation.
export const PRICING_VERSION = '2026-10-08-ref1';
export const PAYMENT_FEE_RATE = .08;
export const PAYMENT_FIXED_USD = .30;
export const minimumCreditValue = 79.99 / 3500;
export const NET_USD_PER_CREDIT = (79.99 * (1 - PAYMENT_FEE_RATE) - PAYMENT_FIXED_USD) / 3500;
export const TARGET_MARGIN = .625;

export type ReferenceUsage = {
  imageCount?: number;
  audioCount?: number;
  videoSeconds?: number;
};

export function quoteCost(apiCost: number) {
  if (!Number.isFinite(apiCost) || apiCost <= 0) throw new Error('Verified positive cost required');
  const costBudget = apiCost * 1.20 + .02;
  const credits = Math.ceil(costBudget / (NET_USD_PER_CREDIT * (1 - TARGET_MARGIN)) - 1e-9);
  const netRevenue = credits * NET_USD_PER_CREDIT;
  const contributionMargin = 1 - costBudget / netRevenue;
  if (contributionMargin < .60) throw new Error('Minimum margin not met');
  return { version: PRICING_VERSION, credits, apiCost, costBudget, netRevenue, contributionMargin, grossMargin: contributionMargin };
}

export const creditPacks = [{dollars:12.99,credits:500},{dollars:24.99,credits:1000},{dollars:59.99,credits:2500},{dollars:79.99,credits:3500}];
export type Resolution = '480p' | '720p' | '1080p';

export const pricing = {
 'wan-3-0':{provider:'runway',costs:{'480p':.05,'720p':.10,'1080p':.20}},
 'wan-3-0-prime':{provider:'runway',costs:{'480p':.068,'720p':.14,'1080p':.28}},
 'runway-4-5':{provider:'runway',costs:{'720p':.12}},
 'grok-imagine-1-5':{provider:'runway',costs:{'480p':.10,'720p':.16,'1080p':.29}},
 'seedance-2-0':{provider:'runway',costs:{'480p':.36,'720p':.36,'1080p':.40}},
 'seedance-2-5':{provider:'runway',costs:{'480p':.20,'720p':.30,'1080p':.68}},
} as const;

function durationSupported(modelId:string, duration:number) {
 if (modelId === 'runway-4-5') return [6,8,10].includes(duration);
 if (modelId === 'wan-3-0' || modelId === 'wan-3-0-prime') return duration >= 2 && duration <= 30;
 if (modelId === 'grok-imagine-1-5') return duration >= 1 && duration <= 15;
 if (modelId === 'seedance-2-0') return duration >= 4 && duration <= 15;
 if (modelId === 'seedance-2-5') return duration >= 4 && duration <= 30;
 return false;
}

export function providerApiCost(modelId:string,duration:number,resolution='720p',refs:ReferenceUsage={}) {
 if(!Number.isInteger(duration) || !durationSupported(modelId, duration)) throw new Error('Unsupported duration.');
 const model=pricing[modelId as keyof typeof pricing];
 if(!model) throw new Error('Verified provider pricing unavailable.');
 const perSecond=(model.costs as Record<string,number>)[resolution];
 if(!perSecond) throw new Error('Unsupported resolution.');

 const imageCount=Math.max(0,Math.floor(refs.imageCount ?? 0));
 const audioCount=Math.max(0,Math.floor(refs.audioCount ?? 0));
 const videoSeconds=Math.max(0,Number(refs.videoSeconds ?? 0));
 let apiCost=perSecond*duration;

 if(modelId==='grok-imagine-1-5') {
   if(imageCount>7 || audioCount>3) throw new Error('Too many Grok references.');
   if(audioCount>0 && imageCount===0) throw new Error('Grok audio references require an image reference.');
   if(imageCount>0 && resolution==='1080p') throw new Error('Grok image references are capped at 720p.');
   apiCost += .01*(imageCount+audioCount);
 }

 if(modelId==='seedance-2-5') {
   if(imageCount>30 || audioCount>10 || videoSeconds>30) throw new Error('Seedance 2.5 reference limit exceeded.');
   const inputRate = resolution==='480p' ? .10 : resolution==='720p' ? .15 : .34;
   apiCost = Math.max(.80, apiCost + inputRate*videoSeconds);
 }

 return apiCost;
}

export function quoteVideo(modelId:string,duration:number,resolution='720p',refs:ReferenceUsage={}) {
 const apiCost=providerApiCost(modelId,duration,resolution,refs);
 const quote=quoteCost(apiCost);
 return {...quote,creditsPerSecond:quote.credits/duration,provider:pricing[modelId as keyof typeof pricing].provider,resolution,duration,pricingVersion:PRICING_VERSION,references:{imageCount:refs.imageCount??0,audioCount:refs.audioCount??0,videoSeconds:refs.videoSeconds??0}};
}
