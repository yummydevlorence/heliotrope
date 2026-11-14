import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:you@example.com',
  Deno.env.get('VAPID_PUBLIC')!,
  Deno.env.get('VAPID_PRIVATE')!,
)

function statusCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? error.statusCode
    : undefined
}

async function push(userIds: string[], payload: Record<string, string>) {
  if (!userIds.length) return

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('endpoint,sub')
    .in('user_id', [...new Set(userIds)])
  if (error) throw error

  await Promise.all(
    (subs || []).map(async (row) => {
      try {
        await webpush.sendNotification(row.sub, JSON.stringify(payload), { TTL: 120, urgency: 'high' })
      } catch (pushError) {
        const code = statusCode(pushError)
        if (code === 404 || code === 410) {
          const { error: deleteError } = await db
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', row.endpoint)
          if (deleteError) console.error('Unable to remove expired push subscription:', deleteError)
        } else {
          console.error('Push notification failed:', pushError)
        }
      }
    }),
  )
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    // Manila is UTC+8 with no daylight saving.
    const now = new Date(Date.now() + 8 * 3600e3)
    const today = now.toISOString().slice(0, 10)
    const hhmm = now.toISOString().slice(11, 16)
    const dow = now.getUTCDay()
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
    let fired = 0

    const { data: alarms, error: alarmsError } = await db
      .from('alarms')
      .select('*')
      .eq('enabled', true)
      .eq('time', `${hhmm}:00`)
    if (alarmsError) throw alarmsError

    for (const alarm of alarms || []) {
      if (alarm.last_fired === today) continue
      const days = Array.isArray(alarm.days) ? alarm.days : []
      const due = days.length ? days.includes(dow) : alarm.once_date === today
      if (!due) continue

      await push([alarm.target], {
        title: `⏰ ${alarm.label || 'Alarm'}`,
        body: `It's ${hhmm}`,
        tag: `alarm-${alarm.id}`,
        kind: 'alarm',
        sound: alarm.sound_url || '',
      })

      const { error: updateError } = await db
        .from('alarms')
        .update({ last_fired: today, ...(days.length ? {} : { enabled: false }) })
        .eq('id', alarm.id)
      if (updateError) throw updateError
      fired++
    }

    const { data: events, error: eventsError } = await db
      .from('events')
      .select('*')
      .eq('date', today)
      .eq('notified', false)
      .not('remind_min', 'is', null)
    if (eventsError) throw eventsError

    for (const event of events || []) {
      const [hours, minutes] = event.start_time.split(':').map(Number)
      const start = hours * 60 + minutes
      if (nowMin < start - event.remind_min || nowMin > start) continue

      let targets: string[] = event.for_user ? [event.for_user] : []
      if (!targets.length) {
        const { data: users, error: usersError } = await db.from('profiles').select('id')
        if (usersError) throw usersError
        targets = (users || []).map((user) => user.id)
      }

      await push(targets, {
        title: `📅 ${event.title}`,
        body: event.remind_min ? `Starts in ${start - nowMin} min` : 'Starting now',
        tag: `event-${event.id}`,
        kind: 'event',
      })

      const { error: updateError } = await db
        .from('events')
        .update({ notified: true })
        .eq('id', event.id)
      if (updateError) throw updateError
      fired++
    }

    return new Response(JSON.stringify({ ok: true, fired }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unable to send scheduled notifications:', error)
    return new Response(JSON.stringify({ ok: false, error: 'notification processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
