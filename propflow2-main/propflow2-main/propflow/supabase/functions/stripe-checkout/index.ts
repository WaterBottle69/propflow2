/**
 * PropFlow — Stripe Checkout Edge Function
 * ─────────────────────────────────────────
 * Creates a Stripe Checkout session for plan upgrades.
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY     — Stripe secret key (sk_live_... or sk_test_...)
 *   SUPABASE_URL          — Auto-set
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-set
 *   APP_URL               — Your site URL (e.g. https://propflow.ai)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLANS: Record<string, { name: string; priceId: string; amount: number }> = {
  starter: { name: 'Starter',  priceId: Deno.env.get('STRIPE_PRICE_STARTER') || '', amount: 4900 },
  pro:     { name: 'Pro',      priceId: Deno.env.get('STRIPE_PRICE_PRO') || '',     amount: 9900 },
  team:    { name: 'Team',     priceId: Deno.env.get('STRIPE_PRICE_TEAM') || '',    amount: 24900 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user } } = await sb.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) throw new Error('Invalid session')

    const { plan, action } = await req.json()

    // ── CANCEL subscription ─────────────────────────────────────────
    if (action === 'create_portal') {
      const { data: sub } = await sb
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()

      if (!sub?.stripe_customer_id) throw new Error('No active subscription found')

      const portalResp = await stripeRequest('POST', '/v1/billing_portal/sessions', {
        customer:   sub.stripe_customer_id,
        return_url: `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/dashboard/billing.html`,
      })

      return json({ url: portalResp.url })
    }

    // ── CREATE checkout ─────────────────────────────────────────────
    if (!plan || !PLANS[plan]) throw new Error(`Invalid plan: ${plan}`)
    const planInfo = PLANS[plan]

    // Get or create Stripe customer
    let customerId: string
    const { data: profile } = await sb
      .from('profiles')
      .select('stripe_customer_id, email, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      const customer = await stripeRequest('POST', '/v1/customers', {
        email: profile?.email || user.email!,
        name:  profile?.full_name || '',
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Save customer ID
      await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'

    // Create checkout session
    const session = await stripeRequest('POST', '/v1/checkout/sessions', {
      customer:            customerId,
      mode:                'subscription',
      payment_method_types: 'card',
      line_items: JSON.stringify([{
        price:    planInfo.priceId,
        quantity: 1,
      }]),
      subscription_data: JSON.stringify({
        trial_period_days: 14,
        metadata: { supabase_user_id: user.id, plan },
      }),
      success_url: `${appUrl}/dashboard/billing.html?success=1&plan=${plan}`,
      cancel_url:  `${appUrl}/dashboard/billing.html?canceled=1`,
      allow_promotion_codes: 'true',
      metadata: JSON.stringify({ supabase_user_id: user.id, plan }),
    })

    return json({ url: session.url, session_id: session.id })
  } catch (err) {
    console.error('[stripe-checkout]', err)
    return json({ error: err instanceof Error ? err.message : 'Server error' }, 400)
  }
})

async function stripeRequest(method: string, path: string, body: Record<string, string>) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set')

  const resp = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: Object.entries(body)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
  })

  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error?.message || 'Stripe error')
  return data
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
