export const subscriptionPlans = {
  starter: {
    name: "Starter",
    monthlyPriceUsd: 49,
    annualPriceUsd: 399,
    monthlyCredits: 2000,
    annualFirstCycleBonusCredits: 300,
    monthlyRollover: false,
    annualRollover: true,
  },
  premium: {
    name: "Premium",
    monthlyPriceUsd: 79,
    annualPriceUsd: 799,
    monthlyCredits: 4000,
    annualFirstCycleBonusCredits: 600,
    monthlyRollover: false,
    annualRollover: true,
  },
  pro: {
    name: "Pro",
    monthlyPriceUsd: 119,
    annualPriceUsd: 1299,
    monthlyCredits: 6000,
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
