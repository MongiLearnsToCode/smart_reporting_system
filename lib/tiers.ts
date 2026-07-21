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
