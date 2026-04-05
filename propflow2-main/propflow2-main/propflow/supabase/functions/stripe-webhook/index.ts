/**
 * PropFlow — Stripe Webhook Edge Function
 * ────────────────────────────────────────
 * Handles Stripe subscription lifecycle events and updates Supabase.
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY        — Stripe secret key
 *   STRIPE_WEBHOOK_SECRET    — From Stripe Dashboard → Webhooks → Signing secret
 *   SUPABASE_URL             — Auto-set
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-set
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

const CORS = { 'Access-Control-Allow-Origin': '*' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.text()

    // Verify Stripe webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const signature     = req.headers.get('stripe-signature')

    if (webhookSecret && signature) {
      const valid = await verifyStripeSignature(body, signature, webhookSecret)
      if (!valid) {
        console.error('[stripe-webhook] Invalid signature')
        return new Response('Invalid signature', { status: 400 })
      }
    }

    const event = JSON.parse(body)
    console.log(`[stripe-webhook] Event: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId  = session.metadata?.supabase_user_id
        const plan    = session.metadata?.plan || 'starter'

        if (!userId) break

        await sb.from('subscriptions').upsert({
          user_id:               userId,
          stripe_subscription_id: session.subscription,
          stripe_customer_id:    session.customer,
          plan,
          status:                'trialing',
          created_at:            new Date().toISOString(),
          updated_at:            new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' })

        await sb.from('profiles').update({
          stripe_customer_id:  session.customer,
          subscription_status: 'trial',
          subscription_plan:   plan,
        }).eq('id', userId)

        await createNotification(sb, userId, {
          type:  'system',
          title: `Welcome to PropFlow ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`,
          body:  'Your 14-day trial has started. No charge until your trial ends.',
        })
        break
      }

      case 'customer.subscription.updated':
      case 'invoice.payment_succeeded': {
        const sub  = event.data.object
        const plan = sub.metadata?.plan || await getPlanFromPriceId(sub.items?.data?.[0]?.price?.id)

        const { data: profile } = await sb
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single()

        if (!profile) break

        await sb.from('subscriptions').upsert({
          user_id:               profile.id,
          stripe_subscription_id: sub.id || sub.subscription,
          stripe_customer_id:    sub.customer,
          plan:                  plan || 'starter',
          status:                sub.status || 'active',
          current_period_start:  sub.current_period_start
            ? new Date(sub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end:  sub.cancel_at_period_end || false,
          updated_at:            new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' })

        await sb.from('profiles').update({
          subscription_status: sub.status === 'trialing' ? 'trial' : 'active',
          subscription_plan:   plan || 'starter',
        }).eq('id', profile.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object

        const { data: profile } = await sb
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single()

        if (!profile) break

        await sb.from('subscriptions').update({
          status:     'canceled',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)

        await sb.from('profiles').update({
          subscription_status: 'canceled',
        }).eq('id', profile.id)

        await createNotification(sb, profile.id, {
          type:  'system',
          title: 'Subscription canceled',
          body:  'Your PropFlow subscription has been canceled. You can re-subscribe anytime.',
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object

        const { data: profile } = await sb
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .single()

        if (!profile) break

        await sb.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id)

        await createNotification(sb, profile.id, {
          type:  'system',
          title: 'Payment failed',
          body:  'We could not process your payment. Please update your payment method to keep access.',
          link:  '/dashboard/billing.html',
        })
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[stripe-webhook] Error:', err)
    return new Response(JSON.stringify({ error: 'Webhook error' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────
async function createNotification(
  sb: ReturnType<typeof createClient>,
  userId: string,
  notif: { type: string; title: string; body?: string; link?: string }
) {
  await sb.from('notifications').insert({
    user_id: userId,
    ...notif,
  })
}

function getPlanFromPriceId(priceId: string): string {
  const starterPrice = Deno.env.get('STRIPE_PRICE_STARTER')
  const proPrice     = Deno.env.get('STRIPE_PRICE_PRO')
  const teamPrice    = Deno.env.get('STRIPE_PRICE_TEAM')

  if (priceId === starterPrice) return 'starter'
  if (priceId === proPrice)     return 'pro'
  if (priceId === teamPrice)    return 'team'
  return 'starter'
}

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))
    const timestamp = parts['t']
    const sig       = parts['v1']

    const signedPayload = `${timestamp}.${payload}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
    const computedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    // Timing-safe comparison
    if (computedSig.length !== sig.length) return false
    let mismatch = 0
    for (let i = 0; i < computedSig.length; i++) {
      mismatch |= computedSig.charCodeAt(i) ^ sig.charCodeAt(i)
    }
    return mismatch === 0
  } catch {
    return false
  }
}
