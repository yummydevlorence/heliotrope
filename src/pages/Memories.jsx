import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { compressImage } from '../lib/image'
import { Heart, Pause, Play, Shuffle, Trash2, X } from 'lucide-react'

const MAX_VIDEO_MB = 50 // Supabase free plan limit per file
const FAV = '__fav'
const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const isVideo = (item) => item?.media_type === 'video'
const randomIndex = (length) => Math.floor(Math.random() * length)

const prettyDate = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
const monthLabel = (key) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

// "On this day": same day of the month, in an earlier month or year
function onThisDay(items) {
  const [year, month, day] = todayManila().split('-').map(Number)
  const nowIndex = year * 12 + month
  let best = null
  for (const item of items) {
    const [itemYear, itemMonth, itemDay] = item.taken_on.split('-').map(Number)
    const diff = nowIndex - (itemYear * 12 + itemMonth)
    if (itemDay === day && diff > 0 && (!best || diff < best.diff)) best = { item, diff }
  }
  if (!best) return null
  const { diff } = best
  const label =
    diff % 12 === 0
      ? `${diff / 12} year${diff === 12 ? '' : 's'} ago today`
      : `${diff} month${diff === 1 ? '' : 's'} ago today`
  return { item: best.item, label }
}

const STYLES = `
@keyframes mem-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes mem-zoom { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }
@keyframes mem-from-right { from { opacity: 0; transform: translateX(120px) scale(.94); } to { opacity: 1; transform: none; } }
@keyframes mem-from-left { from { opacity: 0; transform: translateX(-120px) scale(.94); } to { opacity: 1; transform: none; } }
@keyframes mem-sheet { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
@keyframes mem-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes mem-kenburns { from { transform: scale(1); } to { transform: scale(1.08); } }
@keyframes mem-progress { from { width: 0; } to { width: 100%; } }
.mem-kb { animation: mem-kenburns 6s ease-out forwards; }
.mem-progress { position: absolute; top: 0; left: 0; height: 3px; background: var(--ac); animation: mem-progress 4s linear forwards; z-index: 5; }
.mem-fade-bg { animation: mem-fade .8s ease both; }
.mem-viewer { animation: mem-fade .12s ease both; }
.mem-slide-zoom { animation: mem-zoom .4s var(--ease) both; }
.mem-slide-right { animation: mem-from-right .4s var(--ease) both; }
.mem-slide-left { animation: mem-from-left .4s var(--ease) both; }
.mem-sheet { animation: mem-sheet .45s var(--spring) both; }

.mem-glass { background: rgba(255,255,255,.12); border: .5px solid rgba(255,255,255,.22); border-radius: 14px; }
.mem-pill {
  display: inline-block; font-size: 12px; padding: 4px 12px; border-radius: 999px; border: .5px solid rgba(255,255,255,.22);
  background: rgba(255,255,255,.12); color: #d6d6de; white-space: nowrap; cursor: pointer;
}
.mem-pill.on { background: var(--ac); color: #0e0e10; border-color: var(--ac); font-weight: 600; }
.mem-month {
  position: sticky; top: 8px; z-index: 4; display: inline-block; font-size: 12px; padding: 4px 12px; border-radius: 999px;
  background: rgba(14,14,16,.78); border: .5px solid rgba(255,255,255,.22); color: #e8e8ee;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.mem-photo {
  position: relative; overflow: hidden; border-radius: 12px; background: rgba(255,255,255,.08);
  border: .5px solid rgba(255,255,255,.3); box-shadow: 0 4px 12px rgba(0,0,0,.5);
  cursor: pointer; -webkit-tap-highlight-color: transparent; animation: mem-rise .45s var(--ease) both;
}
.mem-photo:active { transform: scale(.98); }
.mem-heart {
  position: absolute; top: 6px; right: 6px; z-index: 2; width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 14px; border: .5px solid rgba(255,255,255,.3);
  background: rgba(14,14,16,.55); color: #f2f2f5; cursor: pointer;
}
.mem-heart.on { color: #ff8a9a; }
.mem-strip {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 12px; background: rgba(14,14,16,.55);
  border-top: .5px solid rgba(255,255,255,.2);
}
.mem-round {
  width: 38px; height: 38px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,.12); border: .5px solid rgba(255,255,255,.22); color: #f2f2f5; font-size: 16px; cursor: pointer;
}
.mem-round.on { color: #ff8a9a; }
@media (prefers-reduced-motion: reduce) {
  .mem-photo, .mem-viewer, .mem-slide-zoom, .mem-slide-right, .mem-slide-left, .mem-sheet, .mem-kb, .mem-progress, .mem-fade-bg { animation: none !important; }
}
`

export default function Memories({ session }) {
  const me = session.user.id
  const [items, setItems] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [album, setAlbum] = useState('All')
  const [viewer, setViewer] = useState(null) // index in filtered list
  const [animating, setAnimating] = useState(false)
  const stageRef = useRef(null)
  const slideTimer = useRef(null)
  const [dragX, setDragX] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [form, setForm] = useState(null) // { file, kind, preview, caption, album, date }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const touch = useRef(null)
  const busyRef = useRef(false)
  const deletingRef = useRef(false)
  const mountedRef = useRef(false)
  const refreshingUrls = useRef(new Set())
  const retriedUrls = useRef(new Set())

  async function load() {
    try {
      const { data, error: loadError } = await supabase
        .from('memories')
        .select('*')
        .order('taken_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (loadError) throw loadError
      if (!mountedRef.current) return
      setItems(data || [])
      if (data?.length) {
        const { data: signed, error: signError } = await supabase.storage
          .from('photos')
          .createSignedUrls(data.map((item) => item.path), 3600)
        if (signError) throw signError
        if (!mountedRef.current) return
        const map = {}
        signed?.forEach((entry) => {
          if (entry.signedUrl) map[entry.path] = entry.signedUrl
        })
        setUrls(map)
      } else {
        setUrls({})
      }
      setError('')
    } catch (loadError) {
      console.error('Unable to load memories and signed URLs:', loadError)
      if (mountedRef.current) setError('Could not load memories. Check the memories table and policies.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (form?.preview) URL.revokeObjectURL(form.preview)
    }
  }, [form?.preview])

  const albums = useMemo(() => [...new Set(items.map((item) => item.album).filter(Boolean))], [items])
  const shown = useMemo(() => {
    if (album === 'All') return items
    if (album === FAV) return items.filter((item) => item.is_favorite)
    return items.filter((item) => item.album === album)
  }, [items, album])

  // month groups; the newest memory in each month becomes the big hero card
  const groups = useMemo(() => {
    const map = new Map()
    shown.forEach((item, index) => {
      const key = item.taken_on.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push({ item, index })
    })
    return [...map.entries()]
  }, [shown])

  const today = useMemo(() => onThisDay(items), [items])
  const oldest = items.length ? items[items.length - 1].taken_on : null

  const open = viewer !== null
  const current = open ? shown[viewer] : null

  async function refreshUrl(path) {
    if (refreshingUrls.current.has(path) || retriedUrls.current.has(path)) return
    retriedUrls.current.add(path)
    refreshingUrls.current.add(path)
    try {
      const { data, error: signError } = await supabase.storage.from('photos').createSignedUrl(path, 3600)
      if (signError) throw signError
      if (!data?.signedUrl) throw new Error('No signed URL returned.')
      if (mountedRef.current) setUrls((currentUrls) => ({ ...currentUrls, [path]: data.signedUrl }))
    } catch (signError) {
      console.error('Unable to refresh memory URL:', signError)
      retriedUrls.current.delete(path)
      if (mountedRef.current) setError('Could not reload a memory. Try refreshing the page.')
    } finally {
      refreshingUrls.current.delete(path)
    }
  }

  function markUrlLoaded(path) {
    retriedUrls.current.delete(path)
  }

  async function toggleFavorite(item) {
    const next = !item.is_favorite
    setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, is_favorite: next } : entry)))
    const { error: favError } = await supabase.from('memories').update({ is_favorite: next }).eq('id', item.id)
    if (favError) {
      console.error('Unable to update favorite:', favError)
      setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, is_favorite: !next } : entry)))
      setError(`Could not save favorite: ${favError.message}`)
    }
  }

  function settle(target, after) {
    clearTimeout(slideTimer.current)
    setAnimating(true)
    setDragX(target)
    slideTimer.current = setTimeout(() => {
      setAnimating(false)
      after?.()
    }, 230)
  }

  function go(direction) {
    if (shown.length < 2 || animating) return
    const width = stageRef.current?.clientWidth || 360
    settle(-direction * width, () => {
      setViewer((index) => (index + direction + shown.length) % shown.length)
      setDragX(0)
    })
  }

  function openViewer(index) {
    clearTimeout(slideTimer.current)
    setAnimating(false)
    setDragX(0)
    setPlaying(false)
    setViewer(index)
  }

  function shuffle() {
    if (shown.length < 2) return openViewer(0)
    let index = randomIndex(shown.length)
    if (index === viewer) index = (index + 1) % shown.length
    openViewer(index)
  }

  useEffect(() => () => clearTimeout(slideTimer.current), [])

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

  useEffect(() => {
    if (!open || !playing || shown.length < 2) return
    if (isVideo(shown[viewer])) return
    const timer = setTimeout(() => go(1), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playing, viewer, shown.length])

  function onTouchStart(event) {
    if (animating) return
    const point = event.touches[0]
    if (event.target.tagName === 'VIDEO') {
      const rect = event.target.getBoundingClientRect()
      if (point.clientY > rect.bottom - rect.height * 0.25) {
        touch.current = null
        return
      }
    }
    touch.current = { x: point.clientX, y: point.clientY, dy: 0, horizontal: null }
  }

  function onTouchMove(event) {
    const start = touch.current
    if (!start) return
    const point = event.touches[0]
    const dx = point.clientX - start.x
    start.dy = point.clientY - start.y
    if (start.horizontal === null && (Math.abs(dx) > 8 || Math.abs(start.dy) > 8)) {
      start.horizontal = Math.abs(dx) > Math.abs(start.dy)
    }
    if (start.horizontal) {
      setDragX(shown.length > 1 ? dx : dx / 4)
    }
  }

  function onTouchEnd() {
    const start = touch.current
    touch.current = null
    const dx = dragX
    if (start?.horizontal) {
      const width = stageRef.current?.clientWidth || 360
      if (shown.length > 1 && Math.abs(dx) > Math.min(70, width * 0.2)) go(dx < 0 ? 1 : -1)
      else settle(0)
    } else if (start?.horizontal === false && start.dy > 110) {
      setViewer(null)
    }
  }

  function pickFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null
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
      album: album === 'All' || album === FAV ? '' : album,
      date: todayManila(),
    })
  }

  async function save(event) {
    event.preventDefault()
    if (busyRef.current || !form) return
    busyRef.current = true
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
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, body, { contentType })
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
        const { error: removeError } = await supabase.storage.from('photos').remove([path])
        if (removeError) console.error('Unable to clean up unsaved memory media:', removeError)
        throw insertError
      }
      setForm(null)
      await load()
    } catch (saveError) {
      console.error('Unable to save memory:', saveError)
      setError(`Could not save: ${saveError?.message || saveError}`)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function remove(item) {
    if (deletingRef.current) return
    if (!confirm('Delete this memory?')) return
    deletingRef.current = true
    try {
      const { error: deleteError } = await supabase.from('memories').delete().eq('id', item.id)
      if (deleteError) throw deleteError
      const { error: removeError } = await supabase.storage.from('photos').remove([item.path])
      if (removeError) {
        console.error('Unable to remove memory file:', removeError)
        setError('The memory was deleted, but its media file could not be removed.')
      } else {
        setError('')
      }
      setViewer(null)
      setItems((list) => list.filter((entry) => entry.id !== item.id))
    } catch (deleteError) {
      console.error('Unable to delete memory:', deleteError)
      setError('Could not delete it.')
    } finally {
      deletingRef.current = false
    }
  }

  function renderMedia(item) {
    const url = urls[item.path]
    if (!url) return null
    return isVideo(item) ? (
      <video
        src={`${url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        onError={() => refreshUrl(item.path)}
        onLoadedData={() => markUrlLoaded(item.path)}
        className="w-full h-full object-cover pointer-events-none"
      />
    ) : (
      <img
        src={url}
        alt={item.caption || ''}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => refreshUrl(item.path)}
        onLoad={() => markUrlLoaded(item.path)}
      />
    )
  }

  function renderTile(item, index, hero, delay) {
    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() => openViewer(index)}
        onKeyDown={(event) => event.key === 'Enter' && openViewer(index)}
        className="mem-photo"
        style={{ aspectRatio: hero ? '16 / 11' : '1 / 1', animationDelay: `${delay}ms` }}
      >
        {renderMedia(item)}
        <button
          type="button"
          className={`mem-heart ${item.is_favorite ? 'on' : ''}`}
          aria-label={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(event) => {
            event.stopPropagation()
            toggleFavorite(item)
          }}
        >
          <Heart size={15} fill={item.is_favorite ? 'currentColor' : 'none'} />
        </button>
        {isVideo(item) && (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-white"><Play size={10} fill="currentColor" /></span>
        )}
        {hero && (
          <div className="mem-strip">
            <span className="block text-[15px]">{item.caption || prettyDate(item.taken_on)}</span>
            <span className="block text-[11px] text-[#c9c9d2]">
              {prettyDate(item.taken_on)}
              {item.album ? ` · ${item.album}` : ''}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 pb-8">
      <style>{STYLES}</style>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Memories</h2>
        <div className="flex gap-2">
          {items.length > 1 && (
            <button className="mem-round !w-[30px] !h-[30px]" onClick={shuffle} aria-label="Shuffle">
              <Shuffle size={17} />
            </button>
          )}
          <button className="mem-pill on" onClick={() => fileRef.current?.click()}>
            + Add
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pickFile} />
      </div>

      {items.length > 0 && (
        <div className="mem-glass flex justify-between px-3 py-2 mb-3 text-[13px]">
          <span>{items.length} {items.length === 1 ? 'memory' : 'memories'}</span>
          {oldest && <span className="text-[#c9c9d2]">since {prettyDate(oldest)}</span>}
        </div>
      )}

      {today && album === 'All' && (
        <div
          role="button"
          tabIndex={0}
          className="mem-glass flex items-center gap-3 p-2 mb-4 cursor-pointer"
          onClick={() => openViewer(shown.findIndex((entry) => entry.id === today.item.id))}
          onKeyDown={(event) =>
            event.key === 'Enter' && openViewer(shown.findIndex((entry) => entry.id === today.item.id))
          }
        >
          <div className="mem-photo shrink-0" style={{ width: 64, height: 64, animation: 'none' }}>
            {renderMedia(today.item)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[#c9c9d2]">On this day · {today.label}</p>
            <p className="truncate text-[15px]">{today.item.caption || prettyDate(today.item.taken_on)}</p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3">
          <button className={`mem-pill ${album === 'All' ? 'on' : ''}`} onClick={() => setAlbum('All')}>All</button>
          <button className={`mem-pill ${album === FAV ? 'on' : ''}`} onClick={() => setAlbum(FAV)}>
            <Heart size={12} fill="currentColor" className="inline -mt-0.5" /> Favorites
          </button>
          {albums.map((name) => (
            <button key={name} className={`mem-pill ${album === name ? 'on' : ''}`} onClick={() => setAlbum(name)}>
              {name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-center text-red-300 mb-2">{error}</p>}
      {loading && <p className="text-center text-sm text-[#a8a8b3] mt-10">Loading...</p>}
      {!loading && shown.length === 0 && (
        <div className="mem-glass text-center p-6 mt-6">
          <p className="text-[15px]">{album === FAV ? 'No favorites yet' : 'Start your first memory'}</p>
          <p className="text-xs text-[#c9c9d2] mt-1">
            {album === FAV ? 'Tap the heart on a photo to keep it here.' : 'Add a photo or video of the two of you.'}
          </p>
        </div>
      )}

      {groups.map(([key, list]) => (
        <section key={key} className="mb-5">
          <span className="mem-month">{monthLabel(key)}</span>
          <div className="mt-2 space-y-1.5">
            {list[0] && renderTile(list[0].item, list[0].index, true, 0)}
            {list.length > 1 && (
              <div className="grid grid-cols-3 gap-1.5">
                {list.slice(1).map(({ item, index }, position) => (
                  renderTile(item, index, false, Math.min(position, 9) * 50)
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-3 mem-viewer">
          <form onSubmit={save} className="glass mem-sheet w-full max-w-sm rounded-3xl p-5 space-y-3">
            <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            {form.kind === 'video' ? (
              <video src={form.preview} controls muted playsInline className="w-full max-h-52 rounded-2xl bg-black" />
            ) : (
              <img src={form.preview} alt="" className="w-full max-h-52 object-cover rounded-2xl" />
            )}
            <input
              className="glass-input"
              placeholder="Caption"
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
            />
            {albums.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {albums.map((name) => (
                  <button
                    type="button"
                    key={name}
                    className={`mem-pill ${form.album === name ? 'on' : ''}`}
                    onClick={() => setForm({ ...form, album: form.album === name ? '' : name })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <input
              className="glass-input"
              placeholder="Album (optional)"
              value={form.album}
              onChange={(e) => setForm({ ...form, album: e.target.value })}
            />
            <input
              type="date"
              className="glass-input"
              value={form.date}
              required
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <div className="flex gap-2">
              <button type="button" className="glass-btn flex-1" disabled={busy} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button disabled={busy} className="glass-btn flex-1 !bg-[var(--ac)] !text-[#0e0e10]">
                {busy ? (form.kind === 'video' ? 'Uploading video...' : 'Saving...') : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {current && (
        <div className="mem-viewer fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col">
          {playing && !isVideo(current) && <div key={current.id} className="mem-progress" />}
          <div className="flex justify-between items-center p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
            <button className="mem-round" onClick={() => setViewer(null)} aria-label="Close"><X size={18} /></button>
            <span className="mem-pill !cursor-default">{viewer + 1} / {shown.length}</span>
            <div className="flex gap-2">
              <button className="mem-round" onClick={shuffle} aria-label="Shuffle"><Shuffle size={17} /></button>
              <button className="mem-round" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
            </div>
          </div>

          <div
            ref={stageRef}
            className="relative flex-1 min-h-0 overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {(shown.length >= 3 ? [-1, 0, 1] : shown.length === 2 ? [0, 1] : [0]).map((offset) => {
              const item = shown[(viewer + offset + shown.length) % shown.length]
              const url = urls[item.path]
              return (
                <div
                  key={shown.length >= 3 ? item.id : `${item.id}-${offset}`}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `translate3d(calc(${offset * 100}% + ${dragX}px), 0, 0)`,
                    transition: animating ? 'transform .23s cubic-bezier(.2,.8,.3,1)' : 'none',
                    willChange: 'transform',
                  }}
                >
                  {url &&
                    (isVideo(item) ? (
                      offset === 0 && (
                        <video
                          src={url}
                          controls
                          autoPlay
                          playsInline
                          onError={() => refreshUrl(item.path)}
                          onLoadedData={() => markUrlLoaded(item.path)}
                          onEnded={() => playing && go(1)}
                          className="max-w-full max-h-full rounded-xl"
                        />
                      )
                    ) : (
                      <img
                        src={url}
                        alt={item.caption || ''}
                        draggable={false}
                        decoding="async"
                        onError={() => refreshUrl(item.path)}
                        onLoad={() => markUrlLoaded(item.path)}
                        className={`max-w-full max-h-full object-contain select-none rounded-xl ${playing && offset === 0 ? 'mem-kb' : ''}`}
                      />
                    ))}
                </div>
              )
            })}
          </div>

          <div className="p-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
            <div className="mem-glass flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                {current.caption && <p className="text-[15px] truncate">{current.caption}</p>}
                <p className="text-xs text-[#c9c9d2]">
                  {prettyDate(current.taken_on)}
                  {current.album ? ` · ${current.album}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`mem-round ${current.is_favorite ? 'on' : ''}`}
                  onClick={() => toggleFavorite(current)}
                  aria-label="Favorite"
                >
                  <Heart size={18} fill={current.is_favorite ? 'currentColor' : 'none'} />
                </button>
                {current.user_id === me && (
                  <button className="mem-round" style={{ color: '#f09595' }} onClick={() => remove(current)} aria-label="Delete">
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}