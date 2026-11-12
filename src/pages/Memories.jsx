import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { compressImage } from '../lib/image'

const MAX_VIDEO_MB = 50 // Supabase free plan limit per file
const todayManila = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const isVideo = (item) => item?.media_type === 'video'

// small, steady tilt per memory (-3deg to +3deg), based on its id
function tiltFor(id) {
  let hash = 0
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return ((Math.abs(hash) % 61) - 30) / 10
}

const prettyDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&display=swap');
@keyframes mem-pop { from { opacity: 0; transform: translateY(24px) scale(.85) rotate(0deg); } to { opacity: 1; transform: translateY(0) scale(1) rotate(var(--tilt, 0deg)); } }
@keyframes mem-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mem-zoom { from { opacity: 0; transform: scale(.88); } to { opacity: 1; transform: none; } }
@keyframes mem-from-right { from { opacity: 0; transform: translateX(120px) scale(.92) rotate(2deg); filter: blur(6px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes mem-from-left { from { opacity: 0; transform: translateX(-120px) scale(.92) rotate(-2deg); filter: blur(6px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes mem-sheet { from { opacity: 0; transform: translateY(40px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes mem-kenburns { from { transform: scale(1); } to { transform: scale(1.08); } }
@keyframes mem-progress { from { width: 0; } to { width: 100%; } }
.mem-kb { animation: mem-kenburns 6s ease-out forwards; }
.mem-progress { position: absolute; top: 0; left: 0; height: 3px; background: var(--ac); animation: mem-progress 4s linear forwards; z-index: 5; }
.mem-fade-bg { animation: mem-fade .8s ease both; }
.mem-hand { font-family: 'Caveat', 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive; }
.mem-tile {
  position: relative; display: block; width: 100%; text-align: left; border: 0; cursor: pointer;
  background: #f4efe6; color: #2b2622; padding: 10px 10px 8px; border-radius: 4px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, .5), 0 1px 2px rgba(0, 0, 0, .4);
  transform: rotate(var(--tilt, 0deg));
  animation: mem-pop .6s var(--spring) backwards;
  transition: transform .3s var(--spring), box-shadow .3s;
  -webkit-tap-highlight-color: transparent;
}
.mem-tile::before {
  content: ""; position: absolute; top: -9px; left: 50%; width: 54px; height: 18px;
  transform: translateX(-50%) rotate(-3deg); background: rgba(230, 201, 168, .75);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .25); z-index: 2;
}
.mem-tile:hover { transform: rotate(0deg) translateY(-4px) scale(1.03); box-shadow: 0 14px 28px rgba(0, 0, 0, .6); z-index: 3; }
.mem-tile:active { transform: rotate(0deg) scale(.97); }
.mem-photo { position: relative; aspect-ratio: 1 / 1; overflow: hidden; background: #d9d2c5; }
.mem-cap { padding: 8px 2px 0; min-height: 3.1rem; }
.mem-cap-text { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 1.15rem; line-height: 1.15; }
.mem-date { display: block; margin-top: 2px; font-size: .95rem; color: #7a6f60; }
.mem-viewer { animation: mem-fade .25s ease both; }
.mem-slide-zoom { animation: mem-zoom .4s var(--ease) both; }
.mem-slide-right { animation: mem-from-right .4s var(--ease) both; }
.mem-slide-left { animation: mem-from-left .4s var(--ease) both; }
.mem-sheet { animation: mem-sheet .45s var(--spring) both; }
@media (prefers-reduced-motion: reduce) {
  .mem-tile, .mem-viewer, .mem-slide-zoom, .mem-slide-right, .mem-slide-left, .mem-sheet, .mem-kb, .mem-progress, .mem-fade-bg { animation: none !important; }
}
`

export default function Memories({ session }) {
  const me = session.user.id
  const [items, setItems] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [album, setAlbum] = useState('All')
  const [viewer, setViewer] = useState(null) // index in filtered list
  const [slide, setSlide] = useState('zoom') // zoom | left | right
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [form, setForm] = useState(null) // { file, kind, preview, caption, album, date }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const touch = useRef(null)

  async function load() {
    const { data, error: loadError } = await supabase
      .from('memories')
      .select('*')
      .order('taken_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (loadError) {
      console.error('Unable to load memories:', loadError)
      setError('Could not load memories. Check the memories table and policies.')
      setLoading(false)
      return
    }
    setItems(data)
    if (data.length) {
      const { data: signed, error: signError } = await supabase.storage
        .from('photos')
        .createSignedUrls(data.map((item) => item.path), 3600)
      if (signError) console.error('Unable to sign media URLs:', signError)
      const map = {}
      signed?.forEach((entry) => {
        if (entry.signedUrl) map[entry.path] = entry.signedUrl
      })
      setUrls(map)
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  useEffect(() => {
    return () => {
      if (form?.preview) URL.revokeObjectURL(form.preview)
    }
  }, [form?.preview])

  const albums = useMemo(
    () => ['All', ...new Set(items.map((item) => item.album).filter(Boolean))],
    [items],
  )
  const shown = useMemo(
    () => (album === 'All' ? items : items.filter((item) => item.album === album)),
    [items, album],
  )

  const open = viewer !== null
  const current = open ? shown[viewer] : null

  function go(direction) {
    if (shown.length < 2) return
    setSlide(direction > 0 ? 'right' : 'left')
    setViewer((index) => (index + direction + shown.length) % shown.length)
  }

  function openViewer(index) {
    setSlide('zoom')
    setPlaying(false)
    setViewer(index)
  }

  // keyboard: arrows to slide, Esc to close
  useEffect(() => {
    if (!open) return
    function onKey(event) {
      if (event.key === 'Escape') setViewer(null)
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown.length])

  // slideshow: next photo every 4s (videos advance when they end)
  useEffect(() => {
    if (!open || !playing || shown.length < 2) return
    if (isVideo(shown[viewer])) return
    const timer = setTimeout(() => go(1), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playing, viewer, shown.length])

  function onTouchStart(event) {
    const point = event.touches[0]
    // let the video's own controls (bottom of the video) scrub without sliding
    if (event.target.tagName === 'VIDEO') {
      const rect = event.target.getBoundingClientRect()
      if (point.clientY > rect.bottom - rect.height * 0.25) {
        touch.current = null
        return
      }
    }
    touch.current = { x: point.clientX, y: point.clientY, horizontal: null }
  }

  function onTouchMove(event) {
    const start = touch.current
    if (!start) return
    const point = event.touches[0]
    const dx = point.clientX - start.x
    const dy = point.clientY - start.y
    if (start.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      start.horizontal = Math.abs(dx) > Math.abs(dy)
    }
    if (start.horizontal) {
      setDragging(true)
      setDragX(dx)
    }
  }

  function onTouchEnd() {
    const start = touch.current
    touch.current = null
    const dx = dragX
    setDragging(false)
    setDragX(0)
    if (start?.horizontal && Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
  }

  function pickFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const kind = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('image/')
        ? 'image'
        : null
    if (!kind) return setError('Photos and videos only.')
    if (kind === 'video' && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return setError(`That video is too big. Max is ${MAX_VIDEO_MB} MB.`)
    }
    setError('')
    setForm({
      file,
      kind,
      preview: URL.createObjectURL(file),
      caption: '',
      album: album === 'All' ? '' : album,
      date: todayManila(),
    })
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    let path
    try {
      let body
      let contentType
      let extension
      if (form.kind === 'image') {
        body = await compressImage(form.file)
        contentType = 'image/jpeg'
        extension = 'jpg'
      } else {
        body = form.file
        contentType = form.file.type || 'video/mp4'
        extension = (form.file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
      }
      path = `memories/${me}/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, body, { contentType })
      if (uploadError) throw uploadError
      const { error: insertError } = await supabase.from('memories').insert({
        user_id: me,
        path,
        media_type: form.kind,
        caption: form.caption.trim() || null,
        album: form.album.trim() || null,
        taken_on: form.date,
      })
      if (insertError) {
        await supabase.storage.from('photos').remove([path])
        throw insertError
      }
      setForm(null)
      await load()
    } catch (saveError) {
      console.error('Unable to save memory:', saveError)
      setError(`Could not save: ${saveError?.message || saveError}`)
    }
    setBusy(false)
  }

  async function remove(item) {
    if (!confirm('Delete this memory?')) return
    const { error: deleteError } = await supabase.from('memories').delete().eq('id', item.id)
    if (deleteError) {
      console.error('Unable to delete memory:', deleteError)
      return setError('Could not delete it.')
    }
    await supabase.storage.from('photos').remove([item.path])
    setViewer(null)
    setItems((list) => list.filter((entry) => entry.id !== item.id))
  }

  return (
    <div className="p-4 pb-8">
      <style>{STYLES}</style>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Memories</h2>
        <button className="glass-btn !py-2 !px-4 text-sm" onClick={() => fileRef.current?.click()}>
          + Add
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pickFile} />
      </div>

      {albums.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3">
          {albums.map((name) => (
            <button
              key={name}
              onClick={() => setAlbum(name)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm transition-colors ${
                album === name ? 'bg-[#e6c9a8] text-[#0e0e10] font-semibold' : 'bg-[#232327] text-[#9a9aa6]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-center text-red-300 mb-2">{error}</p>}
      {loading && <p className="text-center text-sm text-[#63636e] mt-10">Loading...</p>}
      {!loading && shown.length === 0 && (
        <p className="text-center text-sm text-[#63636e] mt-10">No memories yet. Add your first one 📸</p>
      )}

      <div className="grid grid-cols-2 gap-x-5 gap-y-7 px-2 pt-4">
        {shown.map((item, index) => (
          <button
            key={item.id}
            onClick={() => openViewer(index)}
            className="mem-tile"
            style={{
              '--tilt': `${tiltFor(item.id)}deg`,
              animationDelay: `${Math.min(index, 12) * 70}ms`,
            }}
          >
            <div className="mem-photo">
              {urls[item.path] &&
                (isVideo(item) ? (
                  <video
                    src={`${urls[item.path]}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <img src={urls[item.path]} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                ))}
              {isVideo(item) && (
                <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">▶</span>
              )}
            </div>
            <div className="mem-cap mem-hand">
              <span className="mem-cap-text">{item.caption || ''}</span>
              <span className="mem-date">{prettyDate(item.taken_on)}</span>
            </div>
          </button>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4 mem-viewer">
          <form onSubmit={save} className="glass mem-sheet w-full max-w-sm rounded-3xl p-5 space-y-3">
            {form.kind === 'video' ? (
              <video src={form.preview} controls muted playsInline className="w-full max-h-60 rounded-2xl bg-black" />
            ) : (
              <img src={form.preview} alt="" className="w-full max-h-60 object-cover rounded-2xl" />
            )}
            <input className="glass-input" placeholder="Caption" value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            <input className="glass-input" placeholder="Album (optional)" list="album-list" value={form.album}
              onChange={(e) => setForm({ ...form, album: e.target.value })} />
            <datalist id="album-list">
              {albums.filter((name) => name !== 'All').map((name) => <option key={name} value={name} />)}
            </datalist>
            <input type="date" className="glass-input" value={form.date} required
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" className="glass-btn flex-1" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
              <button disabled={busy} className="glass-btn flex-1">
                {busy ? (form.kind === 'video' ? 'Uploading video...' : 'Saving...') : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {current && (
        <div className="mem-viewer fixed inset-0 z-50 bg-black/95 flex flex-col">
          {playing && !isVideo(current) && <div key={current.id} className="mem-progress" />}
          {!isVideo(current) && urls[current.path] && (
            <img
              key={`bg-${current.id}`}
              src={urls[current.path]}
              alt=""
              aria-hidden="true"
              className="mem-fade-bg pointer-events-none absolute inset-0 -z-10 h-full w-full scale-125 object-cover opacity-40 blur-3xl"
            />
          )}
          <div className="flex justify-between items-center p-4">
            <button className="text-2xl" onClick={() => setViewer(null)} aria-label="Close">✕</button>
            <span className="text-xs text-[#9a9aa6]">{viewer + 1} / {shown.length}</span>
            <button
              className="text-sm rounded-full bg-white/10 px-3 py-1"
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            {current.user_id === me ? (
              <button className="text-sm text-red-300" onClick={() => remove(current)}>Delete</button>
            ) : (
              <span className="w-12" />
            )}
          </div>

          <div
            className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <button className="px-3 text-3xl hidden sm:block" onClick={() => go(-1)} aria-label="Previous">‹</button>
            <div
              className="flex-1 h-full min-w-0 flex items-center justify-center"
              style={{
                transform: `translateX(${dragX}px)`,
                transition: dragging ? 'none' : 'transform .3s var(--ease)',
              }}
            >
              <div key={current.id} className={`mem-slide-${slide} w-full h-full flex items-center justify-center`}>
                {urls[current.path] &&
                  (isVideo(current) ? (
                    <video
                      src={urls[current.path]}
                      controls
                      autoPlay
                      playsInline
                      onEnded={() => playing && go(1)}
                      className="max-w-full max-h-full rounded-xl"
                    />
                  ) : (
                    <img
                      src={urls[current.path]}
                      alt={current.caption || ''}
                      draggable={false}
                      className={`max-w-full max-h-full object-contain select-none rounded-xl ${playing ? 'mem-kb' : ''}`}
                    />
                  ))}
              </div>
            </div>
            <button className="px-3 text-3xl hidden sm:block" onClick={() => go(1)} aria-label="Next">›</button>
          </div>

          <div key={`cap-${current.id}`} className="mem-slide-zoom p-4 text-center">
            {current.caption && <p className="mem-hand text-2xl">{current.caption}</p>}
            <p className="text-xs text-[#9a9aa6] mt-1">
              {current.taken_on}{current.album ? ` · ${current.album}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}