export const subscriptionPlans = {
  starter: {
    name: "Starter",
    monthlyPriceUsd: 39,
    annualPriceUsd: 299,
    monthlyCredits: 600,
    annualFirstCycleBonusCredits: 300,
    monthlyRollover: false,
    annualRollover: true,
  },
  premium: {
    name: "Premium",
    monthlyPriceUsd: 69,
    annualPriceUsd: 599,
    monthlyCredits: 1500,
    annualFirstCycleBonusCredits: 600,
    monthlyRollover: false,
    annualRollover: true,
  },
  pro: {
    name: "Pro",
    monthlyPriceUsd: 109,
    annualPriceUsd: 999,
    monthlyCredits: 3000,
    annualFirstCycleBonusCredits: 900,
    monthlyRollover: false,
    annualRollover: true,
  },
} as const;

export type SubscriptionPlanId = keyof typeof subscriptionPlans;

export function annualSavingsUsd(planId: SubscriptionPlanId) {
  const plan = subscriptionPlans[planId];
  return plan.monthlyPriceUsd * 12 - plan.annualPriceUsd;
}

export function annualCreditTotal(planId: SubscriptionPlanId) {
  const plan = subscriptionPlans[planId];
  return plan.monthlyCredits * 12 + plan.annualFirstCycleBonusCredits;
}
