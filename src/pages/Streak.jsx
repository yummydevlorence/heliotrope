import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { play } from '../Sfx.js'
import { compressImage } from '../lib/image'
import { checkFace, enrollFace, hasFaceProfile } from './face'
import Pet from './pet'
import { Camera, Crown, Flame, Flower2, Hourglass, Sparkles, X } from 'lucide-react'

// Streak levels: the flame upgrades as the streak grows
const LEVELS = [
  { min: 0, name: 'Spark', Icon: Flame, color: '#c9a27a', size: 48 },
  { min: 3, name: 'Ember', Icon: Flame, color: '#f0b83a', size: 52 },
  { min: 10, name: 'Blaze', Icon: Flame, color: '#f58a3c', size: 58 },
  { min: 30, name: 'Inferno', Icon: Flame, color: '#ff5b4a', size: 64 },
  { min: 60, name: 'Radiant', Icon: Sparkles, color: '#ffd76a', size: 62 },
  { min: 100, name: 'Royal', Icon: Crown, color: '#ffc542', size: 62 },
  { min: 365, name: 'Heliotrope', Icon: Flower2, color: '#ffb52e', size: 66 },
]

function levelFor(days) {
  let index = 0
  LEVELS.forEach((level, i) => {
    if (days >= level.min) index = i
  })
  const level = LEVELS[index]
  const next = LEVELS[index + 1] || null
  const progress = next ? (days - level.min) / (next.min - level.min) : 1
  return { index, level, next, progress }
}

const STYLES = `
@keyframes st-pop { from { transform: scale(.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes st-flame { 0%, 100% { transform: scale(1) rotate(-3deg); } 50% { transform: scale(1.1) rotate(3deg); } }
@keyframes st-wait { 50% { opacity: .45; } }
.st-fire { font-size: 3rem; display: inline-block; animation: st-flame 1.6s ease-in-out infinite; }
.st-num { animation: st-pop .5s var(--spring) both; }
.st-wait { animation: st-wait 1.8s ease-in-out infinite; }
.st-pic { position: relative; aspect-ratio: 3 / 4; border-radius: 18px; overflow: hidden; background: #0e0e10; box-shadow: inset 3px 3px 8px rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; }
.st-pic img { width: 100%; height: 100%; object-fit: cover; }
.st-chip { position: absolute; left: 8px; bottom: 8px; background: rgba(0,0,0,.65); color: #f2f2f5; font-size: 11px; padding: 2px 8px; border-radius: 999px; }
.st-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.st-day { aspect-ratio: 1; border: 0; border-radius: 12px; background: #0e0e10; color: #9a9aa6; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.st-day:disabled { opacity: .5; }
.st-half { background: #3e3e45; color: #f2f2f5; cursor: pointer; }
.st-done { background: var(--ac); color: #0e0e10; font-weight: 700; cursor: pointer; }
.st-today { outline: 2px solid var(--ac); outline-offset: 1px; }
.st-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 14px; border-radius: 18px; color: inherit; text-align: left; cursor: pointer; }
.st-thumb { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #232327; background: #0e0e10; display: inline-block; }
.st-modal { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.75); display: flex; align-items: center; justify-content: center; padding: 16px; }
.st-sheet { width: 100%; max-width: 420px; max-height: 90dvh; overflow-y: auto; background: #232327; border-radius: 24px; padding: 18px; animation: st-pop .35s var(--spring) both; }
@keyframes st-levelup { 0% { transform: scale(.4) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.25) rotate(6deg); opacity: 1; } 100% { transform: none; } }
.st-lvl { display: inline-block; animation: st-levelup .8s var(--spring) both; }
.st-badge { display: inline-block; margin-top: 6px; padding: 3px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; letter-spacing: .04em; border: .5px solid currentColor; background: rgba(255,255,255,.06); }
.st-track { height: 6px; border-radius: 6px; background: #0e0e10; overflow: hidden; box-shadow: inset 1px 1px 3px rgba(0,0,0,.6); }
.st-track > span { display: block; height: 100%; border-radius: 6px; transition: width .6s ease; }
@media (prefers-reduced-motion: reduce) { .st-fire, .st-num, .st-wait, .st-sheet, .st-lvl { animation: none !important; } }
`

const manilaToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

function addDays(date, amount) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + amount)
  return d.toISOString().slice(0, 10)
}

const pretty = (date, long = false) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    weekday: long ? 'long' : undefined,
    month: long ? 'long' : 'short',
    day: 'numeric',
    year: long ? 'numeric' : undefined,
  })

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })

function timeLeft() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  const minutes = Math.max(0, Math.floor((end - now) / 60000))
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function calcStreaks(done, today) {
  let current = 0
  let cursor = done.has(today) ? today : addDays(today, -1)
  while (done.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }
  let best = 0
  let run = 0
  let previous = null
  for (const day of [...done].sort()) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return { current, best }
}

function Slot({ title, post, url, empty, extra, onOpen, onImageError }) {
  return (
    <div className="text-center">
      <div className="st-pic" onClick={post ? onOpen : undefined} style={post ? { cursor: 'pointer' } : undefined}>
        {post && url && <img src={url} alt={`${title}'s selfie`} onError={() => onImageError(post.image_path)} />}
        {post && !url && <span className="st-wait text-sm text-[#63636e]">Loading…</span>}
        {!post && empty}
        {post && (
          <span className="st-chip">
            {pretty(post.post_date)} · {timeOf(post.created_at)}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold mt-2">{title}</p>
      {extra}
    </div>
  )
}

const FACE_STEPS = ['Face the camera', 'Turn slightly left', 'Turn slightly right']

function FaceEnroll({ userId, canCancel, onDone, onCancel }) {
  const [shots, setShots] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const shotsRef = useRef([])
  const busyRef = useRef(false)

  useEffect(() => {
    shotsRef.current = shots
  }, [shots])
  useEffect(() => () => shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url)), [])

  async function addShot(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Photos only.')
    setError('')
    try {
      const blob = await compressImage(file)
      setShots((list) => {
        if (list.length >= 3) return list
        const next = [...list, { blob, url: URL.createObjectURL(blob) }]
        shotsRef.current = next
        return next
      })
    } catch (readError) {
      console.error('Unable to read face photo:', readError)
      setError('Could not read that photo. Try another one.')
    }
  }

  function reset() {
    shots.forEach((shot) => URL.revokeObjectURL(shot.url))
    shotsRef.current = []
    setShots([])
    setError('')
  }

  async function save() {
    if (busyRef.current || shots.length !== 3) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await enrollFace(shots.map((shot) => shot.blob), userId)
      if (!result.ok) {
        setError(result.message)
        return
      }
      onDone()
    } catch (saveError) {
      console.error('Unable to enroll face:', saveError)
      setError('Could not save your face. Try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <section className="glass rounded-3xl p-4 text-center space-y-3">
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={addShot} />
      <h3 className="font-semibold">Set up your face photo</h3>
      <p className="text-xs text-[#9a9aa6]">
        Take 3 clear photos of just you, in good light. Your selfies will be checked against these.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {FACE_STEPS.map((label, index) => (
          <div key={label}>
            <div className="st-pic" style={{ aspectRatio: '3 / 4' }}>
              {shots[index] ? (
                <img src={shots[index].url} alt={label} />
              ) : (
                <span className="text-[11px] text-[#63636e] px-1">{index + 1}</span>
              )}
            </div>
            <p className="text-[11px] text-[#9a9aa6] mt-1">{label}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        {canCancel && (
          <button type="button" className="glass-btn flex-1" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        )}
        {shots.length > 0 && (
          <button type="button" className="glass-btn flex-1" disabled={busy} onClick={reset}>
            Start over
          </button>
        )}
        {shots.length < 3 ? (
          <button type="button" className="glass-btn flex-1 !bg-[var(--ac)] !text-[#0e0e10]" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Camera size={16} className="inline mr-1.5 -mt-0.5" />
            Photo {shots.length + 1} of 3
          </button>
        ) : (
          <button type="button" className="glass-btn flex-1 !bg-[var(--ac)] !text-[#0e0e10]" disabled={busy} onClick={save}>
            {busy ? 'Checking your face…' : 'Save my face'}
          </button>
        )}
      </div>
    </section>
  )
}

export default function Streak({ session }) {
  const me = session.user.id
  const [posts, setPosts] = useState([])
  const [urls, setUrls] = useState({})
  const [names, setNames] = useState({})
  const [today, setToday] = useState(manilaToday)
  const [, setTick] = useState(0)
  const [month, setMonth] = useState(() => manilaToday().slice(0, 7))
  const [openDay, setOpenDay] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [enrolled, setEnrolled] = useState(null)
  const [redo, setRedo] = useState(false)
  const fileRef = useRef(null)
  const urlRef = useRef({})
  const busyRef = useRef(false)
  const mountedRef = useRef(false)
  const refreshingUrls = useRef(new Set())
  const retriedUrls = useRef(new Map())

  useEffect(() => {
    let active = true
    hasFaceProfile(me).then((result) => {
      if (active) setEnrolled(result === null ? true : result)
    })
    return () => {
      active = false
    }
  }, [me])

  async function refreshUrl(path) {
    const lastRetry = retriedUrls.current.get(path) || 0
    if (refreshingUrls.current.has(path) || Date.now() - lastRetry < 50 * 60 * 1000) return
    retriedUrls.current.set(path, Date.now())
    refreshingUrls.current.add(path)
    try {
      const { data, error: signError } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
      if (signError) throw signError
      if (!data?.signedUrl) throw new Error('No signed URL returned.')
      urlRef.current[path] = data.signedUrl
      if (mountedRef.current) setUrls({ ...urlRef.current })
    } catch (signError) {
      console.error('Unable to refresh selfie URL:', signError)
      if (mountedRef.current) setError('Could not reload a selfie image. Try refreshing the page.')
    } finally {
      refreshingUrls.current.delete(path)
    }
  }

  const load = useCallback(async () => {
    try {
      const { data, error: loadError } = await supabase
        .from('streak_posts')
        .select('*')
        .order('post_date', { ascending: false })
      if (loadError) throw loadError
      if (!mountedRef.current) return
      setPosts(data || [])
      const missing = (data || []).map((post) => post.image_path).filter((path) => !urlRef.current[path])
      if (missing.length) {
        const { data: signed, error: signError } = await supabase.storage
          .from('photos')
          .createSignedUrls(missing, 3600)
        if (signError) throw signError
        if (!mountedRef.current) return
        signed?.forEach((entry) => {
          if (entry.signedUrl) urlRef.current[entry.path] = entry.signedUrl
        })
        setUrls({ ...urlRef.current })
      }
      setError('')
    } catch (loadError) {
      console.error('Unable to load streak posts or selfie URLs:', loadError)
      if (mountedRef.current) setError('Could not load selfies. Check the streak_posts table and policies.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    supabase
      .from('profiles')
      .select('id,name')
      .then(({ data, error: profilesError }) => {
        if (profilesError) throw profilesError
        if (active && data) setNames(Object.fromEntries(data.map((profile) => [profile.id, profile.name])))
      })
      .catch((profilesError) => {
        console.error('Unable to load profile names:', profilesError)
        if (active) setError('Could not load profile names.')
      })
    const channel = supabase
      .channel('streak-room')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'streak_posts' }, () => {
          if (active) load()
        })
        .subscribe()
      return () => {
        active = false
        mountedRef.current = false
        supabase.removeChannel(channel).catch((channelError) => {
          console.error('Unable to remove streak realtime channel:', channelError)
        })
      }
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => {
      setToday(manilaToday())
      setTick((n) => n + 1)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const byDay = useMemo(() => {
    const map = {}
    for (const post of posts) (map[post.post_date] ||= {})[post.user_id] = post
    return map
  }, [posts])
  const done = useMemo(
    () => new Set(Object.keys(byDay).filter((day) => Object.keys(byDay[day]).length >= 2)),
    [byDay],
  )
  const { current, best } = calcStreaks(done, today)
  // level is based on your best streak, so it never drops if the streak resets
  const { index: levelIndex, level, next, progress } = levelFor(best)
  const prevLevel = useRef(null)
  useEffect(() => {
    if (loading) return
    if (prevLevel.current !== null && levelIndex > prevLevel.current) play('levelup')
    prevLevel.current = levelIndex
  }, [levelIndex, loading])
  const LevelIcon = level.Icon
  const days = Object.keys(byDay).sort().reverse()
  const dayPosts = (day) =>
    Object.values(byDay[day] || {}).sort(
      (a, b) => (a.user_id === me ? 0 : 1) - (b.user_id === me ? 0 : 1),
    )

  const partnerId =
    Object.keys(names).find((id) => id !== me) ||
    posts.find((post) => post.user_id !== me)?.user_id
  const partnerName = (partnerId && names[partnerId]) || 'Partner'
  const myName = names[me] || 'You'

  const todayPosts = byDay[today] || {}
  const mine = todayPosts[me]
  const theirs = Object.values(todayPosts).find((post) => post.user_id !== me)
  const complete = Boolean(mine && theirs)

  let status = 'No selfies yet today'
  if (complete) status = 'Complete today'
  else if (mine) status = `Waiting for ${partnerName}…`
  else if (theirs) status = `${partnerName} posted! Your turn`

  function startSelfie() {
    if (enrolled === false) return setError('Add your face photo first (see above).')
    fileRef.current?.click()
  }

  async function sendSelfie(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busyRef.current) return
    if (!file.type.startsWith('image/')) return setError('Photos only.')
    busyRef.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const blob = await compressImage(file)
      const face = await checkFace(blob, me)
      if (!face.ok) {
        play('error')
        if (face.needsEnroll) setEnrolled(false)
        setError(face.message)
        return
      }
      const path = `streak/${me}/${today}-${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      if (mine) {
        const { error: deleteError } = await supabase.from('streak_posts').delete().eq('id', mine.id)
        if (deleteError) throw deleteError
        const { error: removeError } = await supabase.storage.from('photos').remove([mine.image_path])
        if (removeError) console.error('Unable to remove previous selfie:', removeError)
      }
      const { error: insertError } = await supabase
        .from('streak_posts')
        .insert({ user_id: me, image_path: path })
      if (insertError) {
        const { error: removeError } = await supabase.storage.from('photos').remove([path])
        if (removeError) console.error('Unable to remove unsaved selfie:', removeError)
        throw insertError
      }
      await load()
      play('success')
    } catch (sendError) {
      console.error('Unable to send selfie:', sendError)
      play('error')
      setError(`Could not send your selfie: ${sendError?.message || sendError}`)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const monthLabel = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const shiftMonth = (step) =>
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + step, 1)).toISOString().slice(0, 7))

  return (
    <div className="p-4 pb-8 space-y-5">
      <style>{STYLES}</style>
      <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={sendSelfie} />

      <div className="text-center pt-2">
        <div
          className="st-fire"
          style={{ color: level.color, filter: `drop-shadow(0 0 ${6 + level.size / 6}px ${level.color}88)` }}
        >
          <span key={level.name} className="st-lvl inline-block">
            <LevelIcon size={level.size} strokeWidth={1.6} />
          </span>
        </div>
        <div key={current} className="st-num text-5xl font-bold">{current}</div>
        <p className="text-sm text-[#9a9aa6]">day streak · best {best}</p>
        <span className="st-badge" style={{ color: level.color }}>{level.name}</span>
        {next ? (
          <div className="max-w-[240px] mx-auto mt-3">
            <div className="st-track">
              <span style={{ width: `${Math.round(progress * 100)}%`, background: level.color }} />
            </div>
            <p className="text-[11px] text-[#63636e] mt-1.5">
              {next.min - best} more best-streak {next.min - best === 1 ? 'day' : 'days'} to {next.name}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[#63636e] mt-3">Max level reached 🌻</p>
        )}
        <p className="text-sm mt-2">{status}</p>
        {!complete && (
          <p className="text-xs text-[#63636e] mt-1">
            Day ends in {timeLeft()} · both selfies needed before 12 midnight
          </p>
        )}
      </div>

      {error && <p className="text-sm text-center text-red-300">{error}</p>}
      {notice && <p className="text-sm text-center text-green-300">{notice}</p>}
      {enrolled === false && (
        <FaceEnroll
          userId={me}
          canCancel={redo}
          onCancel={() => {
            setRedo(false)
            setEnrolled(true)
          }}
          onDone={() => {
            setRedo(false)
            setEnrolled(true)
            setNotice('Face photo saved. Your selfies will be checked against it.')
          }}
        />
      )}

      <Pet mealsToday={Object.keys(todayPosts).length} today={today} />

      <div className="grid grid-cols-2 gap-3">
        <Slot
          title={myName}
          post={mine}
          url={mine && urls[mine.image_path]}
          onOpen={() => setOpenDay(today)}
          empty={
            <button
              type="button"
              className="glass-btn !px-4 !py-3 text-sm"
              disabled={busy}
              onClick={startSelfie}
            >
              {busy ? (
                'Checking…'
              ) : (
                <>
                  <Camera size={16} className="inline mr-1.5 -mt-0.5" />
                  Feed with a selfie
                </>
              )}
            </button>
          }
          extra={
            mine &&
            !complete && (
              <button
                type="button"
                className="text-xs text-[#9a9aa6] underline mt-1"
                disabled={busy}
                onClick={startSelfie}
              >
                {busy ? 'Sending…' : 'Retake'}
              </button>
            )
          }
          onImageError={refreshUrl}
        />
        <Slot
          title={partnerName}
          post={theirs}
          url={theirs && urls[theirs.image_path]}
          onOpen={() => setOpenDay(today)}
          empty={<span className="st-wait text-sm text-[#9a9aa6]">
              <Hourglass size={14} className="inline mr-1 -mt-0.5" />
              Waiting for {partnerName}…
            </span>}
          onImageError={refreshUrl}
        />
      </div>
      {enrolled === true && (
        <button
          type="button"
          className="block mx-auto text-xs text-[#9a9aa6] underline"
          onClick={() => {
            setRedo(true)
            setEnrolled(false)
          }}
        >
          Re-do my face photo
        </button>
      )}

      <section className="glass rounded-3xl p-4">
        <div className="flex items-center justify-between mb-3">
          <button type="button" className="px-3 text-xl" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
          <h3 className="font-semibold">{monthLabel}</h3>
          <button type="button" className="px-3 text-xl" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
        </div>
        <div className="st-cal text-center text-[11px] text-[#63636e] mb-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
        </div>
        <div className="st-cal">
          {cells.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} />
            const key = `${month}-${String(day).padStart(2, '0')}`
            const state = done.has(key) ? 'st-done' : byDay[key] ? 'st-half' : ''
            return (
              <button
                key={key}
                type="button"
                disabled={!byDay[key]}
                onClick={() => setOpenDay(key)}
                className={`st-day ${state} ${key === today ? 'st-today' : ''}`}
              >
                {day}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-[#63636e] mt-3 text-center">
          Gold = both selfies · Gray = one selfie · Tap a day to see them
        </p>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Our selfies</h3>
        {loading && <p className="text-center text-sm text-[#63636e]">Loading…</p>}
        {!loading && days.length === 0 && (
          <p className="text-center text-sm text-[#63636e]">No selfies yet. Be the first today</p>
        )}
        <div className="space-y-2">
          {days.map((day) => (
            <button key={day} type="button" className="st-row glass" onClick={() => setOpenDay(day)}>
              <span>
                <span className="block text-sm font-semibold">{pretty(day, true)}</span>
                <span className="block text-xs text-[#9a9aa6]">
                  {done.has(day) ? (
                    <>
                      <Flame size={12} className="inline -mt-0.5" /> Both selfies
                    </>
                  ) : (
                    'One selfie only'
                  )}
                </span>
              </span>
              <span className="flex -space-x-3">
                {dayPosts(day).map((post) =>
                  urls[post.image_path] ? (
                    <img key={post.id} src={urls[post.image_path]} alt="" className="st-thumb" onError={() => refreshUrl(post.image_path)} />
                  ) : (
                    <span key={post.id} className="st-thumb" />
                  ),
                )}
              </span>
            </button>
          ))}
        </div>
      </section>

      {openDay && (
        <div className="st-modal" onClick={() => setOpenDay(null)}>
          <div className="st-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">{pretty(openDay, true)}</h3>
              <button type="button" className="text-xl px-2" onClick={() => setOpenDay(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {dayPosts(openDay).map((post) => (
                <figure key={post.id} className="text-center">
                  <div className="st-pic">
                    {urls[post.image_path] && <img src={urls[post.image_path]} alt="Selfie" onError={() => refreshUrl(post.image_path)} />}
                  </div>
                  <figcaption className="text-xs text-[#9a9aa6] mt-2">
                    {post.user_id === me ? myName : partnerName} · {timeOf(post.created_at)}
                  </figcaption>
                </figure>
              ))}
            </div>
            {!done.has(openDay) && (
              <p className="text-xs text-[#63636e] text-center mt-3">Only one selfie that day.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}