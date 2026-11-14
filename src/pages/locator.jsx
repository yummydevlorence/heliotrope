import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, LocateFixed, MapPin, MapPinOff } from 'lucide-react'
import { supabase } from '../supabase'

const SEND_EVERY_MS = 15000 // don't write to the database more often than this
const MIN_MOVE_M = 15 // ...unless you moved at least this far
const STALE_MS = 10 * 60 * 1000

function distanceM(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

function prettyDistance(m) {
  if (m < 50) return 'right next to you'
  if (m < 1000) return `${Math.round(m / 10) * 10} m away`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km away`
}

function ago(iso, now) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

function mapSrc({ lat, lng }) {
  const d = 0.006
  const bbox = [lng - d, lat - d, lng + d, lat + d].join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`
}

export default function Locator({ session }) {
  const me = session.user
  const [mine, setMine] = useState(null) // my row
  const [theirs, setTheirs] = useState(null) // partner row
  const [name, setName] = useState('Your love')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [myPos, setMyPos] = useState(null)
  const watchRef = useRef(null)
  const lastSent = useRef({ at: 0, lat: 0, lng: 0 })
  const sharing = Boolean(mine?.sharing)

  // load both rows + the partner's name, then keep the partner live
  useEffect(() => {
    let active = true
    supabase
      .from('locations')
      .select('*')
      .then(({ data, error: loadError }) => {
        if (loadError) return setError('Could not load locations. Is the table set up?')
        if (!active) return
        setMine(data.find((row) => row.user_id === me.id) || null)
        setTheirs(data.find((row) => row.user_id !== me.id) || null)
      })
    supabase
      .from('profiles')
      .select('id,name')
      .then(({ data }) => {
        const other = data?.find((profile) => profile.id !== me.id)
        if (active && other?.name) setName(other.name)
      })
    const channel = supabase
      .channel('locations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (payload) => {
        const row = payload.new
        if (!row?.user_id || row.user_id === me.id) return
        setTheirs(row)
      })
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [me.id])

  // keep "x min ago" fresh
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const push = useCallback(
    async (fields) => {
      const row = { user_id: me.id, updated_at: new Date().toISOString(), ...fields }
      const { error: saveError } = await supabase.from('locations').upsert(row)
      if (saveError) setError('Could not update your location.')
      else setError('')
      setMine((old) => ({ ...(old || {}), ...row }))
    },
    [me.id],
  )

  const stopWatching = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = null
  }, [])

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('This device does not support location.')
      return false
    }
    stopWatching()
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setMyPos({ lat, lng })
        const last = lastSent.current
        const due = Date.now() - last.at > SEND_EVERY_MS
        const moved = distanceM(last, { lat, lng }) > MIN_MOVE_M
        if (!last.at || (due && moved) || Date.now() - last.at > 60000) {
          lastSent.current = { at: Date.now(), lat, lng }
          push({ sharing: true, lat, lng, accuracy: Math.round(position.coords.accuracy || 0) })
        }
      },
      (geoError) => {
        stopWatching()
        push({ sharing: false, lat: null, lng: null, accuracy: null })
        setError(
          geoError.code === 1
            ? 'Location permission is off. Allow it in your phone settings, then try again.'
            : 'Could not get your location. Try again outside or with GPS on.',
        )
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )
    return true
  }, [push, stopWatching])

  // if sharing was left on, resume while the app is open
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || !mine) return
    resumed.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mine.sharing) startWatching()
  }, [mine, startWatching])

  useEffect(() => stopWatching, [stopWatching])

  async function toggle() {
    setError('')
    if (sharing) {
      stopWatching()
      lastSent.current = { at: 0, lat: 0, lng: 0 }
      setMyPos(null)
      await push({ sharing: false, lat: null, lng: null, accuracy: null })
    } else if (startWatching()) {
      await push({ sharing: true })
    }
  }

  const live = theirs?.sharing && theirs.lat != null && theirs.lng != null
  const stale = live && now - new Date(theirs.updated_at).getTime() > STALE_MS
  const base = myPos || (mine?.lat != null ? { lat: mine.lat, lng: mine.lng } : null)
  const meters = live && base ? distanceM(base, { lat: theirs.lat, lng: theirs.lng }) : null

  return (
    <div className="lc">
      <style>{`
        .lc { display: grid; gap: 14px; padding-bottom: 8px; }
        .lc-card { padding: 16px; border-radius: 20px; }
        .lc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .lc-title { font-size: 17px; font-weight: 600; }
        .lc-sub { font-size: 13px; opacity: .65; margin-top: 2px; }
        .lc-sw { position: relative; width: 52px; height: 30px; flex: none; border-radius: 99px; border: 0; background: #2d2d33; cursor: pointer; transition: background .25s var(--ease, ease); }
        .lc-sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #f2f2f5; transition: transform .3s var(--spring, ease); }
        .lc-sw.on { background: var(--ac, #e6c9a8); }
        .lc-sw.on::after { transform: translateX(22px); background: #1a1a1d; }
        .lc-map { width: 100%; height: 280px; border: 0; border-radius: 16px; margin-top: 12px; background: #1b1b1f; }
        .lc-dist { font-size: 28px; font-weight: 600; color: var(--ac, #e6c9a8); margin-top: 10px; }
        .lc-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 14px; color: var(--ac, #e6c9a8); text-decoration: none; }
        .lc-empty { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 28px 8px; opacity: .75; }
        .lc-err { font-size: 13px; color: #ff8a7a; }
        .lc-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #5ddc8a; margin-right: 6px; box-shadow: 0 0 8px #5ddc8a; }
        .lc-dot.stale { background: #c9a27a; box-shadow: none; }
      `}</style>

      <section className="glass lc-card">
        <div className="lc-row">
          <div>
            <div className="lc-title">Share my live location</div>
            <div className="lc-sub">
              {sharing ? `${name} can see where you are while the app is open.` : `Only ${name} can see it, and only while this is on.`}
            </div>
          </div>
          <button
            type="button"
            className={`lc-sw ${sharing ? 'on' : ''}`}
            role="switch"
            aria-checked={sharing}
            aria-label="Share my live location"
            onClick={toggle}
          />
        </div>
        {error && <p className="lc-err" style={{ marginTop: 10 }}>{error}</p>}
      </section>

      <section className="glass lc-card">
        <div className="lc-row">
          <div>
            <div className="lc-title">{name}</div>
            <div className="lc-sub">
              {live ? (
                <>
                  <span className={`lc-dot ${stale ? 'stale' : ''}`} />
                  {stale ? 'Last seen ' : 'Updated '}
                  {ago(theirs.updated_at, now)}
                </>
              ) : (
                'Not sharing right now'
              )}
            </div>
          </div>
          <LocateFixed size={22} opacity={0.6} />
        </div>

        {live ? (
          <>
            {meters != null && <div className="lc-dist">{prettyDistance(meters)}</div>}
            <iframe
              className="lc-map"
              title={`${name}'s location`}
              src={mapSrc({ lat: theirs.lat, lng: theirs.lng })}
              loading="lazy"
            />
            <a
              className="lc-link"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${theirs.lat},${theirs.lng}`}
            >
              <ExternalLink size={15} /> Get directions
            </a>
          </>
        ) : (
          <div className="lc-empty">
            {theirs ? <MapPinOff size={30} /> : <MapPin size={30} />}
            <span>{name} hasn't turned on location sharing.</span>
          </div>
        )}
      </section>
    </div>
  )
}