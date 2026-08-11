'use client';

import { useState } from 'react';
import { useAction, useQuery as useConvexQuery } from 'convex/react';
import { Check, ExternalLink, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/utils/client-integrations/shadcn-ui';
import { api } from '@/convex/_generated/api';
import { useEntitlement } from '@/utils/convex/hooks';
import { TIER_LABEL, productKeyFor, type Interval, type Tier } from '@/lib/tiers';
import { SettingsSection } from '@/components/settings/section';

// What each plan is sold on. Prices are deliberately absent — they come from
// Polar, so the page can never advertise a number the checkout won't charge.
const PLANS: { tier: Tier; perks: string[] }[] = [
  { tier: 'free', perks: ['All six block types', 'Unlimited entries', 'Reports and exports'] },
  { tier: 'starter', perks: ['Everything in Free', 'Block-to-block conversion'] },
  { tier: 'pro', perks: ['Everything in Starter', 'AI canvas commands'] },
];

type PolarPrice = { priceAmount?: number | null; priceCurrency?: string | null };
type PolarProduct = { id: string; prices?: PolarPrice[] };

function formatPrice(product: PolarProduct | undefined, interval: Interval): string | null {
  const price = product?.prices?.find((p) => typeof p.priceAmount === 'number');
  if (!price || typeof price.priceAmount !== 'number') return null;
  const amount = price.priceAmount / 100;
  const currency = (price.priceCurrency ?? 'usd').toUpperCase();
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return `${formatted}/${interval === 'yearly' ? 'yr' : 'mo'}`;
}

export function BillingPanel() {
  const entitlement = useEntitlement();
  const [interval, setInterval] = useState<Interval>('monthly');
  const [busy, setBusy] = useState<string | null>(null);

  const products = useConvexQuery(api.billing.getConfiguredProducts, {}) as
    | Record<string, PolarProduct | undefined>
    | undefined;
  const checkout = useAction(api.billing.generateCheckoutLink);
  const portal = useAction(api.billing.generateCustomerPortalUrl);

  // A plan with no product configured in Polar is not offered rather than shown
  // as a button that fails at the checkout — an unconfigured plan is un-buyable.
  function productFor(tier: Tier): PolarProduct | undefined {
    const key = productKeyFor(tier, interval);
    return key ? products?.[key] : undefined;
  }

  async function startCheckout(tier: Tier) {
    const key = productKeyFor(tier, interval);
    const product = productFor(tier);
    if (!key || !product) return;
    setBusy(key);
    try {
      const { url } = await checkout({
        productIds: [product.id],
        origin: window.location.origin,
        successUrl: `${window.location.origin}/settings/billing?checkout=success`,
        // Naming the existing subscription amends it. Omitting it would open a
        // second, parallel subscription and bill for both.
        ...(entitlement.subscriptionId ? { subscriptionId: entitlement.subscriptionId } : {}),
      });
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start checkout');
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    try {
      const { url } = await portal({});
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the billing portal');
      setBusy(null);
    }
  }

  const current = entitlement.tier;
  const periodEnd = entitlement.currentPeriodEnd
    ? new Date(entitlement.currentPeriodEnd).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-3">
      <SettingsSection title="Current plan">
        {entitlement.loading ? (
          <p className="text-[13px] text-zinc-500">Checking your subscription…</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-zinc-100">{TIER_LABEL[current]}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {current === 'free'
                  ? 'No subscription. Upgrade at any time.'
                  : entitlement.cancelAtPeriodEnd && periodEnd
                    ? `Cancelled — access continues until ${periodEnd}.`
                    : entitlement.status === 'past_due'
                      ? 'Payment failed. Update your card to avoid losing access.'
                      : periodEnd
                        ? `Renews on ${periodEnd}.`
                        : 'Active.'}
              </p>
            </div>
            {current !== 'free' ? (
              <Button
                onClick={openPortal}
                disabled={busy === 'portal'}
                variant="outline"
                className="border-zinc-800 bg-transparent text-[13px] font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
              >
                {busy === 'portal' ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                <span className="ml-1.5">Manage billing</span>
              </Button>
            ) : null}
          </div>
        )}
        {current !== 'free' ? (
          <p className="text-xs text-zinc-600">
            Invoices, payment method and cancellation are handled by Polar, who are the
            merchant of record for your subscription.
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Plans">
        <div className="flex justify-center">
          <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
            {(['monthly', 'yearly'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setInterval(option)}
                className={
                  'rounded px-3 py-1 text-xs font-medium capitalize transition-colors ' +
                  (interval === option
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-zinc-400 hover:text-zinc-200')
                }
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map(({ tier, perks }) => {
            const isCurrent = tier === current;
            const product = productFor(tier);
            // "$0" rather than "Free", which the plan name directly above
            // already says — and which reads as a missing price next to two
            // real ones.
            const price = tier === 'free' ? '$0' : formatPrice(product, interval);
            const key = productKeyFor(tier, interval);

            return (
              <div
                key={tier}
                className={
                  'flex flex-col gap-3 rounded-lg border p-4 ' +
                  (isCurrent ? 'border-teal-500/40 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/60')
                }
              >
                <div>
                  <p className="text-[13px] font-semibold text-zinc-200">{TIER_LABEL[tier]}</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-100">
                    {price ?? <span className="text-[13px] font-normal text-zinc-500">Unavailable</span>}
                  </p>
                </div>
                <ul className="flex-1 space-y-1.5">
                  {perks.map((perk) => (
                    <li key={perk} className="flex gap-1.5 text-xs leading-snug text-zinc-400">
                      <Check size={13} className="mt-0.5 shrink-0 text-teal-500/70" />
                      {perk}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <p className="text-center text-xs font-medium text-teal-400">Current plan</p>
                ) : tier === 'free' ? (
                  <p className="text-center text-xs text-zinc-600">Cancel to return here</p>
                ) : (
                  <Button
                    onClick={() => startCheckout(tier)}
                    disabled={!product || busy === key}
                    variant="outline"
                    className="border-teal-500/30 bg-teal-500/10 text-[13px] font-medium text-teal-300 hover:bg-teal-500/20 hover:text-teal-200 disabled:opacity-50"
                  >
                    {busy === key ? <Loader2 size={13} className="animate-spin" /> : null}
                    <span className={busy === key ? 'ml-1.5' : ''}>
                      {!product ? 'Not available' : current === 'free' ? 'Upgrade' : 'Switch'}
                    </span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="flex items-start gap-1.5 text-xs text-zinc-600">
          <Lock size={12} className="mt-0.5 shrink-0" />
          Your plan is set by your subscription, not by this page — it updates when Polar
          confirms the payment.
        </p>
      </SettingsSection>
    </div>
  );
}
