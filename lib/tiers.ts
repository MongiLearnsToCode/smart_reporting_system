// Tiering model (spec §10). The axis is block *capability*, not block count:
// every tier gets all six block types; paid tiers unlock manipulation power.
export type Tier = 'free' | 'starter' | 'pro';

export const TIER_RANK: Record<Tier, number> = { free: 0, starter: 1, pro: 2 };
export const TIER_LABEL: Record<Tier, string> = { free: 'Free', starter: 'Starter', pro: 'Pro' };

// Each premium capability names the minimum tier that unlocks it.
export const CAPABILITY = {
  convert: 'starter', // block-to-block conversion (spec §5, §10)
  nlCommands: 'pro', // AI natural-language canvas commands (spec §5, §10)
} as const;
export type Capability = keyof typeof CAPABILITY;

export function normalizeTier(value: unknown): Tier {
  return value === 'starter' || value === 'pro' ? value : 'free';
}

// Billing interval, as sold. Both are the same tier — only the cadence differs.
export type Interval = 'monthly' | 'yearly';

// The keys the Polar component knows products by. Product *ids* live in env
// (they differ between sandbox and production); these keys are what the code
// reasons about, so a swapped id never changes who is entitled to what.
export const PRODUCT_KEYS = [
  'starterMonthly', 'starterYearly', 'proMonthly', 'proYearly',
] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

const PRODUCT_TIER: Record<ProductKey, Exclude<Tier, 'free'>> = {
  starterMonthly: 'starter',
  starterYearly: 'starter',
  proMonthly: 'pro',
  proYearly: 'pro',
};

export function productKeyFor(tier: Tier, interval: Interval): ProductKey | null {
  if (tier === 'free') return null;
  return `${tier}${interval === 'yearly' ? 'Yearly' : 'Monthly'}` as ProductKey;
}

/**
 * The tier a subscribed product grants.
 *
 * Anything unrecognised resolves to `free` rather than throwing: a product
 * added in the Polar dashboard but not yet in the code must not lock a paying
 * customer out of the app, and must not silently grant them the top tier
 * either. Free is the safe direction — they keep working, and the mismatch
 * shows up as an unentitled subscriber rather than as a billing hole.
 */
export function tierForProductKey(key: unknown): Tier {
  return typeof key === 'string' && key in PRODUCT_TIER
    ? PRODUCT_TIER[key as ProductKey]
    : 'free';
}

// Subscription states that keep a customer entitled. `past_due` is included on
// purpose — a failed renewal is a payment problem, and cutting access mid-dunning
// loses the customer faster than it recovers the invoice. Polar's own retries
// resolve it, and revocation arrives as `canceled`/`revoked`.
const ENTITLING_STATUS = new Set(['active', 'trialing', 'past_due']);

export function statusEntitles(status: unknown): boolean {
  return typeof status === 'string' && ENTITLING_STATUS.has(status);
}

export function tierAllows(tier: Tier, capability: Capability): boolean {
  return TIER_RANK[tier] >= TIER_RANK[CAPABILITY[capability]];
}

// Human-friendly upsell line for a locked capability.
export function upsellFor(capability: Capability): string {
  const need = TIER_LABEL[CAPABILITY[capability]];
  return capability === 'convert'
    ? `Block conversion is a ${need} feature`
    : `Canvas commands are a ${need} feature`;
}
