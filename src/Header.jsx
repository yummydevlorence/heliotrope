import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const KNOWN = [
  { name: import.meta.env.VITE_USER1_NAME, email: import.meta.env.VITE_USER1_EMAIL },
  { name: import.meta.env.VITE_USER2_NAME, email: import.meta.env.VITE_USER2_EMAIL },
]

const sameEmail = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase()

// Profile picture, or the first letter of the name when there's no photo yet.
// Exported so Chat can use it next to the bubbles too.
export function Avatar({ src, name, size = 36, tone = 'gold' }) {
  const [failed, setFailed] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setFailed(false), [src])
  return (
    <span
      className={`pfp pfp-${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        (name?.[0] || 'H').toUpperCase()
      )}
    </span>
  )
}

// crop to a centered square and shrink, so uploads stay small and fast
async function squareJpeg(file, size = 256) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas
    .getContext('2d')
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}

export default function Header({ session }) {
  const me = session.user
  const [profiles, setProfiles] = useState([])
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef(null)
  const menuRef = useRef(null)
  const busyRef = useRef(false)
  const [editing, setEditing] = useState(false)
  const [nick, setNick] = useState('')

  useEffect(() => {
    let active = true
    supabase
      .from('profiles')
      .select('id,name,avatar_url')
      .then(({ data, error }) => {
        if (error) throw error
        if (active && data) {
          setProfiles((list) => {
            const byId = new Map(list.map((profile) => [profile.id, profile]))
            data.forEach((profile) => byId.set(profile.id, profile))
            return [...byId.values()]
          })
        }
      })
      .catch((error) => {
        console.error('Unable to load profiles:', error)
      })
    const channel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const row = payload.new
        if (!row?.id) return
        setProfiles((list) => [...list.filter((item) => item.id !== row.id), row])
      })
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel).catch((channelError) => {
        console.error('Unable to remove profile realtime channel:', channelError)
      })
    }
  }, [])

  // close the menu when you tap anywhere else
  useEffect(() => {
    if (!menu) return
    function onDown(event) {
      if (!menuRef.current?.contains(event.target)) setMenu(false)
    }
    addEventListener('pointerdown', onDown)
    return () => removeEventListener('pointerdown', onDown)
  }, [menu])

  const mine = profiles.find((item) => item.id === me.id)
  const partner = profiles.find((item) => item.id !== me.id)
  const myName =
    mine?.name || KNOWN.find((user) => sameEmail(user.email, me.email))?.name || 'Me'
  const partnerName =
    partner?.name || KNOWN.find((user) => user.email && !sameEmail(user.email, me.email))?.name || 'Heliotrope'

  async function saveNick(event) {
    event.preventDefault()
    const name = nick.trim().slice(0, 20)
    if (!name || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      const { error: saveError } = await supabase.from('profiles').upsert({ id: me.id, name })
      if (saveError) throw saveError
      setProfiles((list) => [
        ...list.filter((item) => item.id !== me.id),
        { id: me.id, name, avatar_url: mine?.avatar_url ?? null },
      ])
      setEditing(false)
      setMenu(false)
    } catch (nickError) {
      console.error('Nickname error:', nickError)
      setMessage('Could not save the nickname. Try again.')
    }
    busyRef.current = false
    setBusy(false)
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      const blob = await squareJpeg(file)
      const path = `${me.id}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${data.publicUrl}?v=${Date.now()}`
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ id: me.id, name: myName, avatar_url: url })
      if (saveError) throw saveError
      setProfiles((list) => [
        ...list.filter((item) => item.id !== me.id),
        { id: me.id, name: myName, avatar_url: url },
      ])
      setMenu(false)
    } catch (uploadFailure) {
      console.error('Profile photo error:', uploadFailure)
      setMessage('Could not upload that photo. Try another one.')
    }
    busyRef.current = false
    setBusy(false)
  }

  return (
    <header className="app-top">
      <div className="app-bar">
        <div className="hd-who">
          <Avatar src={partner?.avatar_url} name={partnerName} size={38} />
          <div className="hd-text">
            <span className="hd-name">{partnerName}</span>
            <span className="hd-sub">Heliotrope</span>
          </div>
        </div>

        <div className="hd-me" ref={menuRef}>
          <button
            type="button"
            className="hd-btn"
            onClick={() => setMenu((open) => !open)}
            aria-label="Your profile"
            aria-expanded={menu}
          >
            <Avatar src={mine?.avatar_url} name={myName} size={34} tone="gray" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          {menu && (
            <div className="hd-menu" style={{ minWidth: 220 }}>
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? 'Please wait...' : 'Change my photo'}
              </button>
              {editing ? (
                <form onSubmit={saveNick} style={{ display: 'flex', gap: 6, padding: '4px 6px' }}>
                  <input
                    className="glass-input"
                    style={{ padding: '.5rem .75rem', fontSize: 14 }}
                    value={nick}
                    maxLength={20}
                    autoFocus
                    placeholder="Nickname"
                    onChange={(event) => setNick(event.target.value)}
                  />
                  <button type="submit" disabled={busy || !nick.trim()} style={{ width: 'auto', color: 'var(--ac)' }}>
                    Save
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNick(myName)
                    setMessage('')
                    setEditing(true)
                  }}
                >
                  Change my nickname
                </button>
              )}
              <button type="button" onClick={() => supabase.auth.signOut()}>
                Logout
              </button>
              {message && <p>{message}</p>}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}