import { createHash } from 'node:crypto';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';

export type BillingMethod = 'card' | 'pix';
export type SubscriptionStatus = 'pending' | 'trialing' | 'active' | 'past_due'
  | 'grace' | 'suspended' | 'canceled';
export class BillingSignatureError extends Error {}

const verifiedEventSchema = z.object({
  eventId: z.string().min(1).max(255),
  eventType: z.string().min(1).max(100),
  occurredAt: z.string().datetime({ offset: true }),
  providerSubscriptionId: z.string().min(1).max(255),
  status: z.enum(['pending','trialing','active','past_due','grace','suspended','canceled']),
  currentPeriodEnd: z.string().datetime({ offset: true }).nullable(),
  graceUntil: z.string().datetime({ offset: true }).nullable(),
  paymentMethod: z.enum(['card','pix']).nullable()
}).strict();
export type VerifiedBillingEvent = z.infer<typeof verifiedEventSchema>;

/** Adapters own provider-specific credentials, request signing and API fields. */
export interface BillingProvider {
  readonly name: string;
  createCustomer(input: { businessId: string; email: string }): Promise<{ providerCustomerId: string }>;
  createCheckout(input: { businessId: string; planCode: string; method: BillingMethod;
    returnUrl: string }): Promise<{ checkoutUrl: string }>;
  getSubscription(providerSubscriptionId: string): Promise<{
    status: SubscriptionStatus; currentPeriodEnd: string | null }>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, unknown>): Promise<VerifiedBillingEvent>;
}

const providers = new Map<string, BillingProvider>();
export function registerBillingProvider(provider: BillingProvider): void {
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(provider.name) || providers.has(provider.name))
    throw new Error('Invalid or duplicate billing adapter');
  providers.set(provider.name, provider);
}
export function getBillingProvider(name: string): BillingProvider | null {
  return providers.get(name) || null;
}
export function billingIsConfigured(): boolean { return providers.size > 0; }

export async function processBillingWebhook(provider: BillingProvider, body: Buffer,
  headers: Record<string, unknown>): Promise<'processed'|'duplicate'|'stale'|'unmatched'> {
  // No database write is attempted until the adapter verifies the signature.
  const event = verifiedEventSchema.parse(await provider.verifyWebhook(body, headers));
  const payloadHash = createHash('sha256').update(body).digest('hex');
  const { data, error } = await supabaseAdmin.rpc('apply_verified_billing_event', {
    p_provider: provider.name, p_event_id: event.eventId, p_event_type: event.eventType,
    p_payload_sha256: payloadHash, p_occurred_at: event.occurredAt,
    p_provider_subscription_id: event.providerSubscriptionId, p_status: event.status,
    p_period_end: event.currentPeriodEnd, p_grace_until: event.graceUntil,
    p_payment_method: event.paymentMethod
  });
  if (error) throw error;
  if (!['processed','duplicate','stale','unmatched'].includes(data))
    throw new Error('Invalid billing outcome');
  return data as 'processed'|'duplicate'|'stale'|'unmatched';
}
