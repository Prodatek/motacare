'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Check, X, Loader2, CreditCard, AlertTriangle,
  Car, ClipboardCheck, Wrench, FileText, Sparkles,
  ArrowRight, Truck, CarFront,
} from 'lucide-react';
import { toast } from 'sonner';
import { subscriptionApi, ApiClientError } from '@/lib/api';
import type { PlansResponse, Subscription } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDate } from '@/lib/utils';

type Tier = 'FREE' | 'PRO' | 'WORKSHOP';
type Interval = 'MONTHLY' | 'YEARLY';

const TIER_ORDER: Tier[] = ['FREE', 'PRO', 'WORKSHOP'];

// Vehicle-tier icons — Free = compact car, Pro = SUV/family car, Workshop = truck/fleet
const TIER_ICON: Record<Tier, React.ReactNode> = {
  FREE: <Car className="h-6 w-6" />,
  PRO: <CarFront className="h-6 w-6" />,
  WORKSHOP: <Truck className="h-6 w-6" />,
};

const TIER_HIGHLIGHT: Record<Tier, string> = {
  FREE: 'border-gray-200',
  PRO: 'border-brand-500 ring-2 ring-brand-100',
  WORKSHOP: 'border-gray-200',
};

const TIER_ICON_BG: Record<Tier, string> = {
  FREE: 'bg-gray-100 text-gray-500',
  PRO: 'bg-brand-50 text-brand-600',
  WORKSHOP: 'bg-purple-50 text-purple-600',
};

function formatNGN(amount: number): string {
  if (amount === 0) return '₦0';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
  }).format(amount);
}

function UsageBar({ label, used, limit, icon }: { label: string; used: number; limit: number; icon: React.ReactNode }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const barColour =
    unlimited ? 'bg-brand-500' :
    pct >= 100 ? 'bg-red-500' :
    pct >= 75  ? 'bg-amber-500' :
    'bg-green-500';

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 mb-2">
        {used}
        <span className="text-sm text-gray-400 font-normal">
          {' '}/ {unlimited ? '∞' : limit}
        </span>
      </p>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColour)}
          style={{ width: unlimited ? '100%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FeatureRow({ label, value }: { label: string; value: string | boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {typeof value === 'boolean' ? (
        value
          ? <Check className="h-4 w-4 text-green-500 shrink-0" />
          : <X className="h-4 w-4 text-gray-300 shrink-0" />
      ) : (
        <Check className="h-4 w-4 text-green-500 shrink-0" />
      )}
      <span className={cn(typeof value === 'boolean' && !value ? 'text-gray-400' : 'text-gray-700')}>
        {typeof value === 'string' ? value : label}
      </span>
    </div>
  );
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<{ vehicles: number; inspectionsThisMonth: number; fixers: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<Interval>('MONTHLY');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [billingUnavailable, setBillingUnavailable] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated! It may take a few seconds to reflect below.');
    } else if (searchParams.get('cancelled') === 'true') {
      toast('Checkout cancelled — no changes were made.');
    }
  }, [searchParams]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [plansRes, subRes, usageRes] = await Promise.allSettled([
        subscriptionApi.getPlans(),
        subscriptionApi.getMySubscription(),
        subscriptionApi.getUsage?.() ?? Promise.reject(),
      ]);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value);
      if (subRes.status === 'fulfilled') setSubscription(subRes.value);
      if (usageRes.status === 'fulfilled') setUsage(usageRes.value as any);
    } catch {
      toast.error('Failed to load subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpgrade = async (tier: Tier) => {
    if (tier === 'FREE') return;
    setActionLoading(`checkout-${tier}`);
    try {
      const { url } = await subscriptionApi.createCheckout(tier as 'PRO' | 'WORKSHOP', billingInterval);
      window.location.href = url;
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.statusCode === 503) {
          setBillingUnavailable(true);
          toast.error('Billing is not configured yet on this server.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Failed to start checkout');
      }
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    try {
      const { url } = await subscriptionApi.createPortalSession(window.location.href);
      window.location.href = url;
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.statusCode === 503) {
          setBillingUnavailable(true);
          toast.error('Billing is not configured yet on this server.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Failed to open billing portal');
      }
      setActionLoading(null);
    }
  };

  const handleCancel = async (immediately: boolean) => {
    setActionLoading('cancel');
    try {
      const updated = await subscriptionApi.cancel(immediately);
      setSubscription(updated);
      toast.success(
        immediately ? 'Subscription cancelled immediately' : 'Subscription will end at the current billing period',
      );
      setShowCancelConfirm(false);
    } catch (error) {
      if (error instanceof ApiClientError) toast.error(error.message);
      else toast.error('Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const currentTier = subscription?.tier ?? 'FREE';

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Manage your plan, billing, and usage limits
          </p>
        </div>

        {/* Billing interval toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {(['MONTHLY', 'YEARLY'] as Interval[]).map((interval) => (
            <button
              key={interval}
              onClick={() => setBillingInterval(interval)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                billingInterval === interval
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {interval === 'MONTHLY' ? 'Monthly' : 'Yearly'}
              {interval === 'YEARLY' && (
                <span className={cn(
                  'ml-1.5 text-xs',
                  billingInterval === 'YEARLY' ? 'text-green-200' : 'text-green-600',
                )}>
                  Save ~17%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Billing unavailable banner */}
      {billingUnavailable && (
        <div className="card p-4 mb-6 border-amber-200 bg-amber-50/60 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">Billing isn't set up on this server yet</p>
            <p className="text-gray-500 mt-0.5">
              You can still see the available plans below, but checkout and billing
              management require a Stripe configuration on the backend.
            </p>
          </div>
        </div>
      )}

      {/* ── Current Plan Card ── */}
      {subscription && (
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', TIER_ICON_BG[currentTier])}>
                {TIER_ICON[currentTier]}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Current plan</p>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    {plans?.[currentTier]?.name ?? currentTier}
                  </h2>
                  <span className={cn(
                    'badge text-xs',
                    subscription.status === 'ACTIVE'   ? 'text-green-700 bg-green-50' :
                    subscription.status === 'TRIALING' ? 'text-blue-700 bg-blue-50' :
                    subscription.status === 'PAST_DUE' ? 'text-orange-700 bg-orange-50' :
                    'text-gray-500 bg-gray-100',
                  )}>
                    {subscription.status === 'TRIALING' ? 'Trial' : subscription.status.replace('_', ' ')}
                  </span>
                </div>

                {subscription.status === 'PAST_DUE' && (
                  <p className="text-sm text-orange-600 mt-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Last payment failed — update your payment method
                  </p>
                )}
                {subscription.trialEndsAt && subscription.status === 'TRIALING' && (
                  <p className="text-sm text-gray-500 mt-1.5">Trial ends {formatDate(subscription.trialEndsAt)}</p>
                )}
                {subscription.currentPeriodEnd && currentTier !== 'FREE' && (
                  <p className="text-sm text-gray-500 mt-1.5">
                    {subscription.cancelAtPeriodEnd
                      ? `Access ends ${formatDate(subscription.currentPeriodEnd)} — won't renew`
                      : `Renews ${formatDate(subscription.currentPeriodEnd)}`}
                  </p>
                )}
              </div>
            </div>

            {currentTier !== 'FREE' && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={handleManageBilling} disabled={actionLoading === 'portal'} className="btn-secondary text-sm">
                  {actionLoading === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Manage billing
                </button>
                {!subscription.cancelAtPeriodEnd && (
                  <button onClick={() => setShowCancelConfirm(true)} className="btn-secondary text-sm text-red-600 hover:bg-red-50">
                    Cancel plan
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Usage bars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
            <UsageBar
              label="Vehicles"
              used={usage?.vehicles ?? 0}
              limit={subscription.vehiclesAllowed}
              icon={<Car className="h-4 w-4" />}
            />
            <UsageBar
              label="Inspections this month"
              used={usage?.inspectionsThisMonth ?? 0}
              limit={subscription.inspectionsPerMonth}
              icon={<ClipboardCheck className="h-4 w-4" />}
            />
            <UsageBar
              label="Fixers"
              used={usage?.fixers ?? 0}
              limit={subscription.fixersAllowed}
              icon={<Wrench className="h-4 w-4" />}
            />
          </div>
        </div>
      )}

      {/* ── Cancel confirmation ── */}
      {showCancelConfirm && (
        <div className="card p-5 mb-6 border-red-200 bg-red-50/50">
          <p className="text-sm font-medium text-gray-900 mb-1">Cancel your subscription?</p>
          <p className="text-sm text-gray-500 mb-4">
            Cancel now and lose access immediately, or wait until your current billing
            period ends — you keep access until then either way, no refund.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleCancel(false)} disabled={actionLoading === 'cancel'} className="btn-secondary text-sm">
              {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel at period end
            </button>
            <button onClick={() => handleCancel(true)} disabled={actionLoading === 'cancel'} className="btn-secondary text-sm text-red-600 hover:bg-red-100">
              Cancel immediately
            </button>
            <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary text-sm">
              Never mind
            </button>
          </div>
        </div>
      )}

      {/* ── Plan comparison cards ── */}
      {plans && (
        <div className="grid md:grid-cols-3 gap-5">
          {TIER_ORDER.map((tier) => {
            const plan = plans[tier];
            const isCurrent = tier === currentTier;
            const price = billingInterval === 'MONTHLY' ? plan.price.monthly : plan.price.yearly;
            const period = billingInterval === 'MONTHLY' ? '/mo' : '/yr';

            return (
              <div key={tier} className={cn('card p-6 flex flex-col relative pt-8', TIER_HIGHLIGHT[tier])}>
                {tier === 'PRO' && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge text-xs bg-brand-600 text-white flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </span>
                )}

                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center mb-3', TIER_ICON_BG[tier])}>
                  {TIER_ICON[tier]}
                </div>

                <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                <p className="text-xs text-gray-400 mt-1 mb-4 min-h-[32px]">{plan.description}</p>

                <div className="mb-5">
                  <span className="text-3xl font-bold text-gray-900">
                    {tier === 'FREE' ? 'Free' : formatNGN(price)}
                  </span>
                  {tier !== 'FREE' && <span className="text-sm text-gray-400">{period}</span>}
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  <FeatureRow label={`${plan.features.vehiclesAllowed === -1 ? 'Unlimited' : plan.features.vehiclesAllowed} vehicle${plan.features.vehiclesAllowed === 1 ? '' : 's'}`} value={true} />
                  <FeatureRow label={`${plan.features.inspectionsPerMonth === -1 ? 'Unlimited' : plan.features.inspectionsPerMonth} inspections / mo`} value={true} />
                  <FeatureRow label={`${plan.features.fixersAllowed === -1 ? 'Unlimited' : plan.features.fixersAllowed} fixer${plan.features.fixersAllowed === 1 ? '' : 's'}`} value={true} />
                  <div className="border-t border-gray-100 my-1" />
                  <FeatureRow label="PDF report exports" value={plan.features.canExportReports} />
                  <FeatureRow label="OBD diagnostics" value={plan.features.canAccessObd} />
                  <FeatureRow label="AI inspection summaries" value={plan.features.canAccessAiSummary} />
                </div>

                {isCurrent ? (
                  <button disabled className="btn-secondary w-full justify-center opacity-60 cursor-default">
                    Current plan
                  </button>
                ) : tier === 'FREE' ? (
                  <button disabled className="btn-secondary w-full justify-center opacity-40 cursor-default">
                    Free forever
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(tier)}
                    disabled={actionLoading === `checkout-${tier}`}
                    className={cn('w-full justify-center', tier === 'PRO' ? 'btn-primary' : 'btn-secondary')}
                  >
                    {actionLoading === `checkout-${tier}`
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <ArrowRight className="h-4 w-4" />}
                    {currentTier === 'FREE' ? 'Upgrade' : 'Switch plan'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {user?.role === 'FIXER' && (
        <p className="text-xs text-gray-400 mt-6 text-center">
          Note: fixer accounts operate under the vehicle owner's plan limits for inspections.
        </p>
      )}
    </div>
  );
}