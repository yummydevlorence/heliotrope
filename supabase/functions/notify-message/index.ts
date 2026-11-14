import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:you@example.com',
  Deno.env.get('VAPID_PUBLIC')!,
  Deno.env.get('VAPID_PRIVATE')!,
)

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function statusCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? error.statusCode
    : undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) return response({ error: 'unauthorized' }, 401)

  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(accessToken)
  if (authError || !user) return response({ error: 'unauthorized' }, 401)

  let payload: { sender?: unknown; text?: unknown; has_image?: unknown }
  try {
    payload = await req.json()
  } catch {
    return response({ error: 'invalid JSON body' }, 400)
  }

  if (payload.sender !== user.id) return response({ error: 'sender does not match user' }, 403)
  if (typeof payload.text !== 'string' && payload.has_image !== true) {
    return response({ error: 'message content is required' }, 400)
  }

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) console.error('Unable to load message sender profile:', profileError)

  const { data: subs, error: subscriptionsError } = await db
    .from('push_subscriptions')
    .select('endpoint,sub')
    .neq('user_id', user.id)
  if (subscriptionsError) {
    console.error('Unable to load push subscriptions:', subscriptionsError)
    return response({ error: 'unable to load push subscriptions' }, 500)
  }

  const notification = JSON.stringify({
    title: profile?.name || 'Heliotrope',
    body: payload.text
      ? String(payload.text).slice(0, 120)
      : payload.has_image
        ? '📷 Sent a photo'
        : 'New message',
    tag: 'message',
    kind: 'message',
  })

  await Promise.all(
    (subs || []).map(async (row) => {
      try {
        await webpush.sendNotification(row.sub, notification, { TTL: 3600, urgency: 'high' })
      } catch (error) {
        const code = statusCode(error)
        if (code === 404 || code === 410) {
          const { error: deleteError } = await db
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', row.endpoint)
          if (deleteError) console.error('Unable to remove expired push subscription:', deleteError)
        } else {
          console.error('Push notification failed:', error)
        }
      }
    }),
  )

  return response({ ok: true })
})
