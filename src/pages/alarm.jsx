import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { play } from '../Sfx.js'
import { enablePush, pushStatus } from '../lib/push'
import { AlarmClock, Bell, CalendarDays, Music } from 'lucide-react'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const REMINDERS = [
  { v: '', t: 'No reminder' },
  { v: 0, t: 'At start' },
  { v: 15, t: '15 min before' },
  { v: 30, t: '30 min before' },
  { v: 60, t: '1 hour before' },
]

const manila = () => new Date(Date.now() + 8 * 3600e3)
const todayStr = () => manila().toISOString().slice(0, 10)
const tomorrowStr = () => new Date(manila().getTime() + 864e5).toISOString().slice(0, 10)
const nowHHMM = () => manila().toISOString().slice(11, 16)
const hhmm = (t) => (t || '').slice(0, 5)

function fmt12(t) {
  const [h, m] = hhmm(t).split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
function fmtDate(d) {
  if (d === todayStr()) return 'Today'
  if (d === tomorrowStr()) return 'Tomorrow'
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-PH', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

// loud beeping while an alarm is ringing in the open app
function useRinger() {
  const ctx = useRef(null)
  const timer = useRef(null)
  const audio = useRef(null)
  const stop = useCallback(() => {
    clearInterval(timer.current)
    if (audio.current) {
      audio.current.pause()
      audio.current.currentTime = 0
      audio.current = null
    }
  }, [])
  const start = useCallback((url) => {
    stop()
    if (url) {
      try {
        audio.current = new Audio(url)
        audio.current.loop = true
        audio.current.play().catch((e) => console.error('Sound blocked:', e))
        navigator.vibrate?.([400, 200, 400, 200, 400])
      } catch (e) {
        console.error('Ringer failed:', e)
      }
      return
    }
    try {
      ctx.current ||= new (window.AudioContext || window.webkitAudioContext)()
      const beep = () => {
        const c = ctx.current
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'square'
        osc.frequency.value = 880
        gain.gain.value = 0.15
        osc.connect(gain).connect(c.destination)
        osc.start()
        osc.stop(c.currentTime + 0.25)
        navigator.vibrate?.([300, 150, 300])
      }
      beep()
      timer.current = setInterval(beep, 700)
    } catch (e) {
      console.error('Ringer failed:', e)
    }
  }, [stop])
  useEffect(() => stop, [stop])
  return { start, stop }
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass w-full max-w-[640px] rounded-t-3xl p-5 space-y-4 max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-white/15" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

const Label = ({ children }) => <p className="text-xs text-[#9a9aa6] mb-1">{children}</p>

export default function Alarms({ session }) {
  const me = session.user.id
  const [view, setView] = useState('alarms')
  const [alarms, setAlarms] = useState([])
  const [events, setEvents] = useState([])
  const [profiles, setProfiles] = useState([])
  const [form, setForm] = useState(null) // { kind: 'alarm'|'event', data }
  const [error, setError] = useState('')
  const [perm, setPerm] = useState(pushStatus())
  const [ringing, setRinging] = useState(null)
  const ringer = useRinger()

  const partner = profiles.find((p) => p.id !== me)
  const partnerName = partner?.name || 'Her'
  const nameOf = (id) => (id === me ? 'me' : partnerName)

  const load = useCallback(async () => {
    return Promise.all([
      supabase.from('alarms').select('*').order('time'),
      supabase.from('events').select('*').gte('date', todayStr()).order('date').order('start_time'),
      supabase.from('profiles').select('id,name'),
    ])
  }, [])

  const refresh = useCallback(() => {
    load().then(([a, e, p]) => {
      if (a.error || e.error) setError('Could not load. Did you run alarms_setup.sql?')
      setAlarms(a.data || [])
      setEvents(e.data || [])
      setProfiles(p.data || [])
    })
  }, [load])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel('alarms-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alarms' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refresh)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [refresh])

  // push arrives while the app is open -> ring out loud
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (event) => {
      if (event.data?.type !== 'alarm') return
      setRinging(event.data)
      ringer.start(event.data.sound)
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [ringer])

  async function turnOn() {
    try {
      await enablePush(me)
      setPerm('granted')
      setError('')
    } catch (e) {
      setPerm(pushStatus())
      setError(
        e.message === 'unsupported'
          ? 'This browser cannot do alarms. On iPhone: Share > Add to Home Screen, then open from there.'
          : 'Notifications are blocked. Allow them in your phone settings for this app.',
      )
    }
  }

  async function saveAlarm(d) {
    const days = d.days || []
    const row = {
      created_by: d.id ? d.created_by : me,
      target: d.target,
      label: d.label.trim(),
      time: d.time,
      days,
      once_date: days.length ? null : d.time > nowHHMM() ? todayStr() : tomorrowStr(),
      enabled: true,
      last_fired: null,
      sound_url: d.sound_url || null,
    }
    const q = d.id ? supabase.from('alarms').update(row).eq('id', d.id) : supabase.from('alarms').insert(row)
    const { error: err } = await q
    if (err) return setError('Could not save the alarm.')
    play('success')
    setForm(null)
    refresh()
  }

  async function toggleAlarm(a) {
    const patch = { enabled: !a.enabled, last_fired: null }
    if (!a.enabled && !a.days.length) patch.once_date = a.time > nowHHMM() ? todayStr() : tomorrowStr()
    await supabase.from('alarms').update(patch).eq('id', a.id)
    refresh()
  }

  async function saveEvent(d) {
    const row = {
      created_by: d.id ? d.created_by : me,
      for_user: d.for_user || null,
      title: d.title.trim(),
      date: d.date,
      start_time: d.start_time,
      end_time: d.end_time || null,
      note: d.note || '',
      remind_min: d.remind_min === '' ? null : Number(d.remind_min),
      notified: false,
    }
    if (!row.title) return setError('Give it a title.')
    const q = d.id ? supabase.from('events').update(row).eq('id', d.id) : supabase.from('events').insert(row)
    const { error: err } = await q
    if (err) return setError('Could not save the event.')
    play('success')
    setForm(null)
    refresh()
  }

  async function remove(kind, id) {
    await supabase.from(kind === 'alarm' ? 'alarms' : 'events').delete().eq('id', id)
    setForm(null)
    refresh()
  }

  const newAlarm = (target) => setForm({ kind: 'alarm', data: { time: '07:00', label: '', days: [], target, sound_url: '' } })
  const newEvent = () =>
    setForm({
      kind: 'event',
      data: { title: '', date: todayStr(), start_time: '09:00', end_time: '', note: '', remind_min: 15, for_user: '' },
    })

  const grouped = events.reduce((acc, e) => ((acc[e.date] ||= []).push(e), acc), {})

  return (
    <div className="p-4 space-y-4 pb-8">
      {perm !== 'granted' && (
        <button onClick={turnOn} className="glass-btn w-full !bg-[var(--ac)] !text-[#0e0e10]">
          <Bell size={16} className="inline mr-1.5 -mt-0.5" />
          Turn on alarms for this phone
        </button>
      )}
      {error && <p className="text-xs text-center text-red-300">{error}</p>}

      <div className="al-seg">
        {[['alarms', 'Alarms', AlarmClock], ['schedule', 'Schedule', CalendarDays]].map(([id, label, Icon]) => (
          <button key={id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>
            <Icon size={15} className="inline mr-1.5 -mt-0.5" />
            {label}
          </button>
        ))}
      </div>

      {view === 'alarms' && (
        <>
          <div className="flex gap-2">
            <button onClick={() => newAlarm(partner?.id || me)} disabled={!partner} className="glass-btn flex-1 text-sm">
              + Alarm for {partnerName}
            </button>
            <button onClick={() => newAlarm(me)} className="glass-btn flex-1 text-sm">
              + Alarm for me
            </button>
          </div>
          {alarms.length === 0 && <p className="text-center text-sm text-[#63636e] mt-8">No alarms yet.</p>}
          {alarms.map((a) => (
            <div key={a.id} className={`glass rounded-2xl p-4 flex items-center gap-3 ${a.enabled ? '' : 'opacity-50'}`}>
              <button className="flex-1 text-left" onClick={() => setForm({ kind: 'alarm', data: { ...a, time: hhmm(a.time) } })}>
                <div className="text-4xl font-light tracking-tight">{fmt12(a.time)}</div>
                <div className="text-sm text-[#9a9aa6]">
                  {a.label || 'Alarm'} ·{' '}
                  {a.target === me
                    ? a.created_by === me ? 'For me' : `From ${partnerName}`
                    : `For ${partnerName}`}
                </div>
                <div className="text-xs text-[#63636e] mt-1">
                  {a.days.length ? a.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(' ') : a.enabled ? `Once · ${fmtDate(a.once_date)}` : 'Once'}
                </div>
              </button>
              <button className={`al-switch ${a.enabled ? 'on' : ''}`} onClick={() => toggleAlarm(a)} aria-label="On or off" />
            </div>
          ))}
        </>
      )}

      {view === 'schedule' && (
        <>
          <button onClick={newEvent} className="glass-btn w-full text-sm">+ Add to schedule</button>
          {events.length === 0 && <p className="text-center text-sm text-[#63636e] mt-8">Nothing planned yet.</p>}
          {Object.entries(grouped).map(([date, list]) => (
            <div key={date} className="space-y-2">
              <p className="text-sm font-semibold text-[var(--ac)]">{fmtDate(date)}</p>
              {list.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setForm({ kind: 'event', data: { ...e, start_time: hhmm(e.start_time), end_time: hhmm(e.end_time), remind_min: e.remind_min ?? '', for_user: e.for_user || '' } })}
                  className="glass rounded-2xl p-3 w-full text-left"
                >
                  <div className="font-semibold">{e.title}</div>
                  <div className="text-xs text-[#9a9aa6]">
                    {fmt12(e.start_time)}{e.end_time ? ` – ${fmt12(e.end_time)}` : ''} ·{' '}
                    {e.for_user ? `For ${nameOf(e.for_user)}` : 'Both of us'}
                    {e.remind_min !== null && <Bell size={11} className="inline ml-1 -mt-0.5" />}
                  </div>
                  {e.note && <div className="text-xs text-[#63636e] mt-1">{e.note}</div>}
                </button>
              ))}
            </div>
          ))}
        </>
      )}

      {form?.kind === 'alarm' && <AlarmForm d={form.data} me={me} partner={partner} partnerName={partnerName} onSave={saveAlarm} onDelete={(id) => remove('alarm', id)} onClose={() => setForm(null)} />}
      {form?.kind === 'event' && <EventForm d={form.data} me={me} partner={partner} partnerName={partnerName} onSave={saveEvent} onDelete={(id) => remove('event', id)} onClose={() => setForm(null)} />}

      {ringing && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-black/90 p-6 text-center">
          <AlarmClock size={72} strokeWidth={1.5} className="animate-pulse" />
          <h2 className="text-2xl font-semibold">{ringing.title}</h2>
          <p className="text-[#9a9aa6]">{ringing.body}</p>
          <button className="glass-btn !px-10" onClick={() => { ringer.stop(); setRinging(null) }}>Dismiss</button>
        </div>
      )}
    </div>
  )
}

function AlarmForm({ d, me, partner, partnerName, onSave, onDelete, onClose }) {
  const [v, setV] = useState(d)
  const toggle = (i) => setV((x) => ({ ...x, days: x.days.includes(i) ? x.days.filter((n) => n !== i) : [...x.days, i].sort() }))
  async function pickSound(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return alert('Max 3 MB, please pick a shorter clip.')
    const path = `${me}/${Date.now()}-${file.name.replace(/[^\w.]/g, '_')}`
    const { error } = await supabase.storage.from('sounds').upload(path, file)
    if (error) return alert('Upload failed.')
    const { data } = supabase.storage.from('sounds').getPublicUrl(path)
    setV((x) => ({ ...x, sound_url: data.publicUrl }))
  }
  return (
    <Sheet title={v.id ? 'Edit alarm' : 'New alarm'} onClose={onClose}>
      <input type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} className="al-time" />
      <input placeholder="Label (e.g. Wake up, love)" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} className="glass-input" />
      <div>
        <Label>Rings on</Label>
        <div className="al-seg">
          {[[me, 'My phone'], [partner?.id, `${partnerName}'s phone`]].map(([id, t]) => id && (
            <button key={id} className={v.target === id ? 'on' : ''} onClick={() => setV({ ...v, target: id })}>{t}</button>
          ))}
        </div>
      </div>
      <div>
        <Label>Repeat (none = just once)</Label>
        <div className="al-days">
          {DAYS.map((l, i) => (
            <button key={i} className={`al-day ${v.days.includes(i) ? 'on' : ''}`} onClick={() => toggle(i)}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <Label>Sound (optional: mp3, or a voice message you recorded)</Label>
        <label className="al-file">
          <Music size={16} className="inline mr-1.5 -mt-0.5" />
          {v.sound_url ? 'Change sound' : 'Add a sound (optional)'}
          <input type="file" accept="audio/*" onChange={pickSound} />
        </label>
        {v.sound_url && (
          <>
            <audio controls src={v.sound_url} className="w-full mt-2" />
            <button className="text-xs text-red-300 mt-1" onClick={() => setV({ ...v, sound_url: null })}>
              Remove sound
            </button>
          </>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        {v.id && <button className="glass-btn !text-red-300" onClick={() => onDelete(v.id)}>Delete</button>}
        <button className="glass-btn flex-1" onClick={onClose}>Cancel</button>
        <button className="glass-btn flex-1 !bg-[var(--ac)] !text-[#0e0e10]" onClick={() => v.time && onSave(v)}>Save</button>
      </div>
    </Sheet>
  )
}

function EventForm({ d, me, partner, partnerName, onSave, onDelete, onClose }) {
  const [v, setV] = useState(d)
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  return (
    <Sheet title={v.id ? 'Edit event' : 'New event'} onClose={onClose}>
      <input placeholder="Title" value={v.title} onChange={set('title')} className="glass-input" />
      <input type="date" value={v.date} onChange={set('date')} className="glass-input" />
      <div className="flex gap-2">
        <div className="flex-1"><Label>Starts</Label><input type="time" value={v.start_time} onChange={set('start_time')} className="glass-input" /></div>
        <div className="flex-1"><Label>Ends (optional)</Label><input type="time" value={v.end_time} onChange={set('end_time')} className="glass-input" /></div>
      </div>
      <div>
        <Label>For</Label>
        <select value={v.for_user} onChange={set('for_user')} className="glass-input">
          <option value="">Both of us</option>
          <option value={me}>Me</option>
          {partner && <option value={partner.id}>{partnerName}</option>}
        </select>
      </div>
      <div>
        <Label>Alarm</Label>
        <select value={v.remind_min} onChange={set('remind_min')} className="glass-input">
          {REMINDERS.map((r) => <option key={r.t} value={r.v}>{r.t}</option>)}
        </select>
      </div>
      <input placeholder="Note (optional)" value={v.note} onChange={set('note')} className="glass-input" />
      <div className="flex gap-2 pt-2">
        {v.id && <button className="glass-btn !text-red-300" onClick={() => onDelete(v.id)}>Delete</button>}
        <button className="glass-btn flex-1" onClick={onClose}>Cancel</button>
        <button className="glass-btn flex-1 !bg-[var(--ac)] !text-[#0e0e10]" onClick={() => onSave(v)}>Save</button>
      </div>
    </Sheet>
  )
}