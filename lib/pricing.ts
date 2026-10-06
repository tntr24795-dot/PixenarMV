// List prices checked against Alibaba Model Studio and Runway Dev, 2026-10-06.
// Gross margin excludes payment fees, tax, storage and failed paid attempts.
export const creditPacks = [
  { dollars: 12.99, credits: 500 }, { dollars: 24.99, credits: 1000 },
  { dollars: 59.99, credits: 2500 }, { dollars: 79.99, credits: 3500 },
];
export const minimumCreditValue = Math.min(...creditPacks.map(p => p.dollars / p.credits));
export type Resolution = "480p" | "720p" | "1080p";
export const pricing = {
  "wan-3-0": { provider: "alibaba", rates: { "480p": 5, "720p": 10, "1080p": 19 }, costs: { "480p": .041256, "720p": .082513, "1080p": .165025 } },
  "wan-3-0-prime": { provider: "alibaba", rates: { "480p": 8, "720p": 16, "1080p": 32 }, costs: { "480p": .0636, "720p": .127199, "1080p": .254399 } },
  "runway-4-5": { provider: "runway", rates: { "720p": 14 }, costs: { "720p": .12 } },
} as const;

export function quoteVideo(modelId: string, duration: number, resolution = "720p") {
  if (!Number.isInteger(duration) || duration < 2 || duration > 30) throw new Error("Unsupported duration.");
  const model = pricing[modelId as keyof typeof pricing];
  if (!model) throw new Error("Verified provider pricing is unavailable.");
  if (modelId === "runway-4-5" && ![6, 8, 10].includes(duration)) throw new Error("Unsupported duration.");
  const rate = (model.rates as Record<string, number>)[resolution];
  const cost = (model.costs as Record<string, number>)[resolution];
  if (!rate || !cost) throw new Error("Unsupported resolution.");
  const credits = rate * duration;
  const apiCost = cost * duration;
  const revenue = credits * minimumCreditValue;
  const grossMargin = 1 - apiCost / revenue;
  if (grossMargin < .60) throw new Error("Pricing does not meet the minimum margin.");
  return { credits, creditsPerSecond: rate, provider: model.provider, apiCost, grossMargin, resolution, duration, pricingVersion: "2026-10-06" };
}
