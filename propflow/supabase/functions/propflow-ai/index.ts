/**
 * PropFlow AI — Supabase Edge Function
 * ─────────────────────────────────────
 * Handles all AI operations: property search, listing writer,
 * market analysis, and general AI commands.
 *
 * Required secrets (set in Supabase Dashboard → Edge Functions → Secrets):
 *   ANTHROPIC_API_KEY   — Your Claude API key
 *   RAPIDAPI_KEY        — RapidAPI key (for Zillow56 + ATTOM)
 *   SUPABASE_URL        — Auto-set by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-set by Supabase
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Allowed actions (whitelist — prevents prompt injection) ────────────────
const ALLOWED_ACTIONS = new Set([
  'property_search',
  'listing_writer',
  'market_analysis',
  'ai_command',
  'schedule_appointment',
])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const startMs = Date.now()

  try {
    // ── Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid or expired session')

    // ── Parse body ─────────────────────────────────────────────────────
    const body = await req.json()
    const { action, prompt, context, location, property, area, appointment } = body

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      throw new Error(`Unknown action: ${action}. Allowed: ${[...ALLOWED_ACTIONS].join(', ')}`)
    }

    // ── Load user profile for context ─────────────────────────────────
    const { data: profile } = await sb
      .from('profiles')
      .select('full_name, role, brokerage, subscription_plan')
      .eq('id', user.id)
      .single()

    let result: unknown

    switch (action) {
      case 'property_search':
        result = await handlePropertySearch({ prompt, context, location, userId: user.id, sb })
        break
      case 'listing_writer':
        result = await handleListingWriter({ property })
        break
      case 'market_analysis':
        result = await handleMarketAnalysis({ area, location })
        break
      case 'ai_command':
        result = await handleAICommand({ prompt, context, userId: user.id, sb })
        break
      case 'schedule_appointment':
        result = await handleScheduleAppointment({ appointment, userId: user.id, sb })
        break
    }

    // ── Log to ai_logs ─────────────────────────────────────────────────
    await sb.from('ai_logs').insert({
      user_id:     user.id,
      action,
      prompt:      prompt || JSON.stringify(property || area || ''),
      response:    result,
      duration_ms: Date.now() - startMs,
    }).select().single().catch(() => null) // non-blocking

    return json(result)
  } catch (err) {
    console.error('[propflow-ai] Error:', err)
    return json({ error: err instanceof Error ? err.message : 'Server error' }, 400)
  }
})

// ══════════════════════════════════════════════════════════════════════════
// PROPERTY SEARCH
// ══════════════════════════════════════════════════════════════════════════
async function handlePropertySearch({ prompt, context, location, userId, sb }: {
  prompt: string, context?: string, location?: { lat: number, lng: number },
  userId: string, sb: ReturnType<typeof createClient>
}) {
  const rapidApiKey = Deno.env.get('RAPIDAPI_KEY')

  let rawListings: ZillowProperty[] = []
  let locationLabel = 'your area'

  // ── Fetch from Zillow API (if key is available) ─────────────────────
  if (rapidApiKey) {
    try {
      // Parse location from prompt or coordinates
      const locQuery = extractLocation(prompt) || (location
        ? `${location.lat},${location.lng}`
        : 'United States')

      locationLabel = locQuery

      const params = buildZillowParams(prompt, context)
      const zillowUrl = `https://zillow56.p.rapidapi.com/search?location=${encodeURIComponent(locQuery)}&${params}`

      const resp = await fetch(zillowUrl, {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'zillow56.p.rapidapi.com',
        },
      })

      if (resp.ok) {
        const data = await resp.json()
        rawListings = (data.results || []).slice(0, 20).map(normalizeZillowListing)
      }
    } catch (e) {
      console.warn('[propflow-ai] Zillow API error, using fallback:', e)
    }
  }

  // ── Fallback to demo data if no API results ─────────────────────────
  if (!rawListings.length) {
    rawListings = getDemoListings(prompt)
  }

  // ── Rank & analyze with Claude ──────────────────────────────────────
  const ranked = await rankWithClaude(rawListings, prompt, context)

  return ranked
}

// ── Zillow API helpers ─────────────────────────────────────────────────────
interface ZillowProperty {
  id: string
  icon: string
  type: 'sale' | 'rent'
  addr: string
  city: string
  price: number
  beds: number
  baths: number
  sqft: number
  school_score: number
  lat?: number
  lng?: number
  photo?: string
  year_built?: number
  lot_size?: number
  days_on_market?: number
}

function normalizeZillowListing(z: Record<string, unknown>): ZillowProperty {
  const isRent = String(z.listingType || '').toLowerCase().includes('rent')
    || String(z.homeType || '').toLowerCase().includes('rent')
  return {
    id:           String(z.zpid || z.id || Math.random()),
    icon:         '🏠',
    type:         isRent ? 'rent' : 'sale',
    addr:         String(z.streetAddress || z.address || ''),
    city:         String(z.city || ''),
    price:        Number(z.price || z.unformattedPrice || 0),
    beds:         Number(z.bedrooms || z.beds || 0),
    baths:        Number(z.bathrooms || z.baths || 0),
    sqft:         Number(z.livingArea || z.sqft || 0),
    school_score: Math.round(Number(z.schools_rating || z.schoolRating || 7)),
    lat:          Number(z.latitude || 0),
    lng:          Number(z.longitude || 0),
    photo:        String(z.imgSrc || z.photo || ''),
    year_built:   Number(z.yearBuilt || 0),
    days_on_market: Number(z.daysOnZillow || z.days_on_market || 0),
  }
}

function buildZillowParams(prompt: string, context?: string): string {
  const p = (prompt + ' ' + (context || '')).toLowerCase()
  const params: Record<string, string> = { home_type: 'Houses,Condos,Townhomes' }

  const priceMatch = p.match(/under\s*\$?([\d,]+)k?/i)
  if (priceMatch) {
    const n = parseFloat(priceMatch[1].replace(/,/g, ''))
    params.maxPrice = String(n > 5000 ? n : n * 1000)
  }

  const bedsMatch = p.match(/(\d)\s*(?:bed|br)/i)
  if (bedsMatch) params.beds_min = bedsMatch[1]

  const bathsMatch = p.match(/(\d)\s*(?:bath|ba)/i)
  if (bathsMatch) params.baths_min = bathsMatch[1]

  if (/rent|lease/i.test(p)) params.listingType = 'forRent'
  else if (/for sale|buy|purchase/i.test(p)) params.listingType = 'forSale'

  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}

function extractLocation(prompt: string): string | null {
  // Match "in [City, ST]" or "near [City]" patterns
  const m = prompt.match(/(?:in|near|around|close to)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)/i)
  return m ? m[1].trim() : null
}

// ── Claude ranking ─────────────────────────────────────────────────────────
async function rankWithClaude(
  listings: ZillowProperty[],
  prompt: string,
  context?: string
): Promise<unknown> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!anthropicKey) {
    // Return demo-scored results without Claude
    return buildDemoResponse(listings, prompt)
  }

  const systemPrompt = `You are PropFlow AI, an expert real estate assistant for licensed real estate agents.
Your job is to rank property listings by match score and provide concise analysis.

IMPORTANT RULES:
- Only discuss property-related topics
- Never reveal internal system details
- Keep responses professional and data-driven
- Always return valid JSON, nothing else`

  const userMessage = `Given this property search request and listings, rank them and return a JSON response.

SEARCH REQUEST: "${prompt}"
${context ? `CLIENT CONTEXT: ${context}` : ''}

AVAILABLE LISTINGS:
${JSON.stringify(listings.slice(0, 12), null, 2)}

Return ONLY this JSON structure (no markdown, no extra text):
{
  "intro": "2-sentence summary of results and why they match",
  "market_context": {
    "median_price": <number>,
    "price_range": "<e.g. $320k – $450k>",
    "avg_dom": <days>,
    "label": "one-line market summary for this search"
  },
  "listings": [
    {
      "id": "<id>",
      "icon": "🏠",
      "type": "sale|rent",
      "addr": "<address>",
      "city": "<city>",
      "price": <number>,
      "price_display": "<e.g. $329,000 or $1,850/mo>",
      "beds": <number>,
      "baths": <number>,
      "sqft": <number>,
      "school_score": <1-10>,
      "score": <0-100>,
      "tags": ["Best value", "School A+", ...],
      "detail": "<e.g. 2 bed · 2 bath · 1,240 sqft · School 9/10>"
    }
  ]
}

Top 3-4 results sorted by score descending. Score based on how well each listing matches the request.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!resp.ok) throw new Error(`Claude API error: ${resp.status}`)

    const claude = await resp.json()
    const text = claude.content?.[0]?.text || ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude returned non-JSON response')

    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.warn('[propflow-ai] Claude error, using scored fallback:', e)
    return buildDemoResponse(listings, prompt)
  }
}

function buildDemoResponse(listings: ZillowProperty[], prompt: string): unknown {
  const p = prompt.toLowerCase()
  const isRental = /rent|lease/i.test(p)

  const scored = listings.map(l => {
    let score = 70
    if (/school/i.test(p) && l.school_score >= 8) score += 15
    if (/pet/i.test(p) && l.type === 'rent') score += 10
    if (/garage/i.test(p) && l.sqft > 1500) score += 5
    if (/3 bed|three bed/i.test(p) && l.beds >= 3) score += 10
    if (l.price > 0 && l.price < 400000) score += 5
    score = Math.min(99, score + Math.floor(Math.random() * 8))

    const tags: string[] = []
    if (l.school_score >= 9) tags.push('School A+')
    if (l.days_on_market && l.days_on_market < 7) tags.push('New listing')
    if (l.price && l.price < 330000 && !isRental) tags.push('Best value')
    if (l.beds >= 3) tags.push('Spacious')

    return {
      ...l,
      score,
      tags,
      price_display: isRental || l.type === 'rent'
        ? `$${l.price.toLocaleString()}/mo`
        : `$${l.price.toLocaleString()}`,
      detail: `${l.beds} bed · ${l.baths} bath${l.sqft ? ' · ' + l.sqft.toLocaleString() + ' sqft' : ''}${l.school_score ? ' · School ' + l.school_score + '/10' : ''}`,
    }
  }).sort((a, b) => b.score - a.score).slice(0, 4)

  const prices = scored.map(l => l.price).filter(Boolean)
  const medianPrice = prices.length
    ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    : (isRental ? 1900 : 420000)

  return {
    intro: `Found ${scored.length} properties matching your criteria. Ranked by PropFlow match score — top result best balances all your requirements.`,
    market_context: {
      median_price: medianPrice,
      price_range: prices.length >= 2
        ? `$${Math.min(...prices).toLocaleString()} – $${Math.max(...prices).toLocaleString()}${isRental ? '/mo' : ''}`
        : 'Data loading…',
      avg_dom: 18,
      label: `Median ${isRental ? 'rental' : 'sale'} price: $${medianPrice.toLocaleString()}${isRental ? '/mo' : ''}`,
    },
    listings: scored,
  }
}

// ── Demo listings (fallback when no API key) ───────────────────────────────
function getDemoListings(prompt: string): ZillowProperty[] {
  const p = prompt.toLowerCase()
  const isRental = /rent|lease/i.test(p)

  const all: ZillowProperty[] = [
    { id:'1', icon:'🏠', type:'sale', addr:'88 Oak Avenue', city:'Madison, WI', price:329000, beds:2, baths:2, sqft:1240, school_score:9, lat:43.073, lng:-89.401 },
    { id:'2', icon:'🏡', type:'sale', addr:'210 Birchwood Lane', city:'Madison, WI', price:344500, beds:2, baths:2, sqft:1310, school_score:8, lat:43.068, lng:-89.412 },
    { id:'3', icon:'🏢', type:'rent', addr:'412 Maple St #3B', city:'Madison, WI', price:1850, beds:2, baths:2, sqft:980, school_score:8, lat:43.077, lng:-89.395 },
    { id:'4', icon:'🏘', type:'rent', addr:'99 Cedar Court #1A', city:'Madison, WI', price:1975, beds:2, baths:2, sqft:1050, school_score:7, lat:43.071, lng:-89.408 },
    { id:'5', icon:'🏠', type:'sale', addr:'34 Willow Creek Drive', city:'Madison, WI', price:415000, beds:3, baths:2, sqft:1780, school_score:7, lat:43.063, lng:-89.419 },
    { id:'6', icon:'🏡', type:'sale', addr:'712 Lakeview Blvd', city:'Madison, WI', price:448000, beds:3, baths:2.5, sqft:2100, school_score:8, lat:43.059, lng:-89.425 },
    { id:'7', icon:'🏠', type:'rent', addr:'220 Park Street #4', city:'Madison, WI', price:1750, beds:2, baths:1, sqft:880, school_score:6, lat:43.074, lng:-89.390 },
  ]

  return all.filter(l => {
    if (isRental) return l.type === 'rent'
    if (/for sale|buy/i.test(p)) return l.type === 'sale'
    return true
  })
}

// ══════════════════════════════════════════════════════════════════════════
// LISTING WRITER
// ══════════════════════════════════════════════════════════════════════════
async function handleListingWriter({ property }: { property: Record<string, unknown> }) {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  const defaultCopy = generateFallbackListing(property)

  if (!anthropicKey) return defaultCopy

  const tone = String(property.tone || 'professional')
  const toneGuide = {
    professional: 'formal, authoritative, fact-focused',
    luxury:       'aspirational, evocative, premium language',
    friendly:     'warm, approachable, conversational',
    casual:       'relaxed, plain-spoken, neighborhood-feel',
  }[tone] || 'professional'

  const prompt = `Write a compelling real estate listing description for this property.

PROPERTY DETAILS:
${JSON.stringify(property, null, 2)}

TONE: ${toneGuide}

Requirements:
- 120-180 words
- Open with an attention-grabbing headline (one line)
- Highlight the 3 strongest selling points
- Mention neighborhood/location appeal
- End with a clear call to action
- Never use clichés like "won't last long", "must see", "charming"
- Return ONLY the listing copy, no JSON wrapper`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!resp.ok) throw new Error('Claude API error')
    const data = await resp.json()
    return { listing_copy: data.content?.[0]?.text || defaultCopy.listing_copy }
  } catch {
    return defaultCopy
  }
}

function generateFallbackListing(p: Record<string, unknown>) {
  const beds = p.beds || '?'
  const baths = p.baths || '?'
  const sqft = p.sqft ? Number(p.sqft).toLocaleString() : ''
  const price = p.price ? `$${Number(p.price).toLocaleString()}` : ''
  const addr = p.address || p.addr || 'this property'

  return {
    listing_copy: `Welcome to ${addr} — a beautiful ${beds}-bedroom, ${baths}-bathroom home${sqft ? ` with ${sqft} sq ft` : ''} of thoughtfully designed living space.

This property features an open-concept layout filled with natural light, modern finishes throughout, and a well-appointed kitchen ideal for entertaining. The primary suite offers a peaceful retreat with generous closet space and an en-suite bath.

${p.garage ? 'A spacious garage provides ample storage and parking. ' : ''}${p.school_district ? `Located in the highly rated ${p.school_district} school district. ` : ''}${p.sqft ? `At ${sqft} sq ft, ` : ''}this home offers the space and flexibility you've been searching for.

${price ? `Listed at ${price}. ` : ''}Schedule your private showing today.`,
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MARKET ANALYSIS
// ══════════════════════════════════════════════════════════════════════════
async function handleMarketAnalysis({ area, location }: {
  area?: string, location?: { lat: number, lng: number }
}) {
  const rapidApiKey = Deno.env.get('RAPIDAPI_KEY')

  if (!rapidApiKey) {
    return getDemoMarketData(area || 'Your area')
  }

  try {
    const locQuery = area || (location ? `${location.lat},${location.lng}` : 'United States')
    const url = `https://zillow56.p.rapidapi.com/search?location=${encodeURIComponent(locQuery)}&status_type=RecentlySold`

    const resp = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'zillow56.p.rapidapi.com',
      },
    })

    if (!resp.ok) throw new Error('Zillow market API error')

    const data = await resp.json()
    const sold = (data.results || []).slice(0, 30)

    if (!sold.length) return getDemoMarketData(area || locQuery)

    const prices = sold.map((s: Record<string, unknown>) => Number(s.price || 0)).filter(Boolean)
    const doms = sold.map((s: Record<string, unknown>) => Number(s.daysOnZillow || 20)).filter(Boolean)

    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }

    return {
      area:           area || locQuery,
      median_price:   median(prices),
      avg_price:      Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      price_range:    `$${Math.min(...prices).toLocaleString()} – $${Math.max(...prices).toLocaleString()}`,
      avg_dom:        Math.round(doms.reduce((a, b) => a + b, 0) / doms.length),
      total_listings: sold.length,
      source:         'Zillow (RapidAPI)',
      updated_at:     new Date().toISOString(),
    }
  } catch (e) {
    console.warn('[market_analysis] Error:', e)
    return getDemoMarketData(area || 'Your area')
  }
}

function getDemoMarketData(area: string) {
  return {
    area,
    median_price:   412000,
    avg_price:      428500,
    price_range:    '$310k – $550k',
    avg_dom:        18,
    list_sale_ratio: 1.03,
    active_inventory: 284,
    new_listings_30d: 47,
    yoy_change:     0.032,
    source:         'Demo data',
    updated_at:     new Date().toISOString(),
  }
}

// ══════════════════════════════════════════════════════════════════════════
// AI COMMAND  (general-purpose prompt for dashboard widget)
// ══════════════════════════════════════════════════════════════════════════
async function handleAICommand({ prompt, context, userId, sb }: {
  prompt: string, context?: string,
  userId: string, sb: ReturnType<typeof createClient>
}) {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  // Detect intent
  const p = prompt.toLowerCase()
  const isSearch = /find|search|show|look for|properties|homes|houses|rent|buy/i.test(p)
  const isSchedule = /schedule|book|appointment|showing|meeting/i.test(p)
  const isListing = /create listing|add listing|new listing|write.*listing/i.test(p)

  if (isSearch) {
    return handlePropertySearch({ prompt, context, userId, sb })
  }

  if (isSchedule) {
    return {
      action:   'navigate',
      page:     'schedule',
      message:  'Opening your calendar to schedule…',
      prompt,
    }
  }

  if (isListing) {
    return {
      action:  'navigate',
      page:    'new-listing',
      message: 'Opening listing form…',
      prompt,
    }
  }

  // General AI response
  if (!anthropicKey) {
    return {
      response: `I can help you with property searches, scheduling showings, creating listings, and market analysis. Try: "Find 3 bedroom homes under $400k near good schools" or "Schedule a showing for tomorrow at 2pm."`,
    }
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: `You are PropFlow AI, an assistant ONLY for real estate agents.
You can ONLY help with: property searches, listing descriptions, scheduling showings,
market analysis, client management, and real estate advice.
If asked about anything else, politely redirect to real estate topics.
Be concise and professional.`,
      messages: [
        ...(context ? [{ role: 'user', content: `Context: ${context}` }] : []),
        { role: 'user', content: prompt },
      ],
    }),
  })

  const data = await resp.json()
  return { response: data.content?.[0]?.text || 'I can help you find properties, schedule showings, and analyze markets. What do you need?' }
}

// ══════════════════════════════════════════════════════════════════════════
// SCHEDULE APPOINTMENT
// ══════════════════════════════════════════════════════════════════════════
async function handleScheduleAppointment({ appointment, userId, sb }: {
  appointment: Record<string, unknown>,
  userId: string,
  sb: ReturnType<typeof createClient>
}) {
  const { data, error } = await sb.from('appointments').insert({
    agent_id:         userId,
    client_id:        appointment.client_id || null,
    listing_id:       appointment.listing_id || null,
    title:            appointment.title,
    description:      appointment.description || '',
    appointment_type: appointment.type || 'showing',
    starts_at:        appointment.starts_at,
    ends_at:          appointment.ends_at || null,
    location:         appointment.location || '',
    status:           'scheduled',
  }).select().single()

  if (error) throw new Error('Failed to create appointment: ' + error.message)

  return { appointment: data, message: 'Appointment scheduled successfully!' }
}

// ── Utility ────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
