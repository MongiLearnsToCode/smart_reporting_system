import { Polar } from '@convex-dev/polar';
import { v } from 'convex/values';
import { components, internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { internalQuery, query, type QueryCtx } from './_generated/server';
import { optionalUserId } from './lib/identity';
import {
  PRODUCT_KEYS,
  normalizeTier,
  statusEntitles,
  tierForProductKey,
  type ProductKey,
  type Tier,
} from '../lib/tiers';

/**
 * Billing lives here, in Convex, and nowhere else.
 *
 * It used to live in the Supabase `user_metadata.settings` blob alongside the
 * user's currency and timezone, which meant `PUT /api/settings` with
 * `{"tier":"pro"}` granted Pro to anyone who asked. The server-side capability
 * checks were real, but they read a value the client controlled, so they were
 * decorative.
 *
 * The fix is not a better check — it is that the client has no writer. A tier is
 * derived, on the server, from a subscription that only Polar's signed webhook
 * can create (see convex/http.ts). There is deliberately no mutation in this
 * file, and none should be added: the moment the app can write an entitlement,
 * the app can be talked into writing one.
 */

// Product ids differ between the Polar sandbox and production, so they are
// configuration, not code. Missing ids are dropped rather than passed as
// undefined — an unconfigured plan should be un-buyable, not broken.
function configuredProducts(): Partial<Record<ProductKey, string>> {
  const fromEnv: Record<ProductKey, string | undefined> = {
    starterMonthly: process.env.POLAR_PRODUCT_STARTER_MONTHLY,
    starterYearly: process.env.POLAR_PRODUCT_STARTER_YEARLY,
    proMonthly: process.env.POLAR_PRODUCT_PRO_MONTHLY,
    proYearly: process.env.POLAR_PRODUCT_PRO_YEARLY,
  };
  const out: Partial<Record<ProductKey, string>> = {};
  for (const key of PRODUCT_KEYS) {
    const id = fromEnv[key];
    if (id) out[key] = id;
  }
  return out;
}

/**
 * Identity for the Polar customer record.
 *
 * A query rather than an inline `ctx.auth` read because the component narrows
 * the ctx it hands `getUserInfo` to `{ runQuery }` — going through a real query
 * keeps this typed instead of casting the ctx back to something wider.
 */
export const currentUser = internalQuery({
  args: {},
  returns: v.object({ userId: v.string(), email: v.string() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');
    if (!identity.email) throw new Error('An email address is required to subscribe');
    return { userId: identity.subject, email: identity.email };
  },
});

export const polar = new Polar<DataModel>(components.polar, {
  // The Polar customer is keyed by the Supabase subject — the same id every
  // other table in this schema uses — so a subscription can always be traced
  // back to exactly one account.
  // The return type is annotated rather than inferred: `internal.billing` is
  // generated from this module's own exports, so inferring through it makes the
  // module's type depend on itself.
  getUserInfo: (ctx): Promise<{ userId: string; email: string }> =>
    ctx.runQuery(internal.billing.currentUser, {}),
  products: configuredProducts(),
});

export const {
  changeCurrentSubscription,
  cancelCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  generateCheckoutLink,
  generateCustomerPortalUrl,
} = polar.api();

export type Entitlement = {
  tier: Tier;
  status: string | null;
  productKey: string | null;
  // Needed to switch plans: a checkout that names the existing subscription
  // amends it, where one that doesn't opens a second parallel subscription.
  subscriptionId: string | null;
  // ISO 8601, as Polar sends it. Left as a string rather than parsed to epoch
  // millis so the value that reaches the UI is the one Polar is billing on.
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export const FREE: Entitlement = {
  tier: 'free',
  status: null,
  productKey: null,
  subscriptionId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/**
 * Resolve what a user is entitled to. Shared by the `entitlement` query and by
 * anything server-side that needs to gate a capability, so there is one
 * definition of "is this person on Pro" rather than one per call site.
 */
export async function entitlementFor(ctx: QueryCtx, userId: string): Promise<Entitlement> {
  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  if (!subscription || !statusEntitles(subscription.status)) return FREE;
  return {
    tier: tierForProductKey(subscription.productKey),
    status: subscription.status ?? null,
    productKey: subscription.productKey ?? null,
    subscriptionId: subscription.id ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    // Set while a cancelled subscription is still inside its paid period. The
    // UI needs it to say "ends on X" rather than "cancelled" while access is live.
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
  };
}

/**
 * The signed-in user's entitlement. Safe to call before the session resolves —
 * it returns free rather than throwing, so the UI renders the free experience
 * while auth is still loading instead of an error boundary.
 */
export const entitlement = query({
  args: {},
  returns: v.object({
    tier: v.union(v.literal('free'), v.literal('starter'), v.literal('pro')),
    status: v.union(v.string(), v.null()),
    productKey: v.union(v.string(), v.null()),
    subscriptionId: v.union(v.string(), v.null()),
    currentPeriodEnd: v.union(v.string(), v.null()),
    cancelAtPeriodEnd: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await optionalUserId(ctx);
    if (!userId) return FREE;
    const found = await entitlementFor(ctx, userId);
    // Normalise on the way out so a bad stored value can never widen access.
    return { ...found, tier: normalizeTier(found.tier) };
  },
});
