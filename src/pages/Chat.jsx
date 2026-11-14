import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { play } from '../Sfx.js'
import { compressImage } from '../lib/image'
import { Camera, Check, CheckCheck, Copy, Loader2, Reply, Send, X } from 'lucide-react'

const EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🙏']
const urlCache = new Map() // path -> { url, exp }

const STYLES = `
@keyframes chat-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes chat-flash { 0%, 100% { background: transparent; } 30% { background: rgba(230,201,168,.22); } }
.chat-msg { animation: chat-in .22s var(--ease) both; }
.chat-flash { animation: chat-flash 1.2s ease; border-radius: 16px; }
.chat-bubble { -webkit-touch-callout: none; touch-action: pan-y; }
@media (prefers-reduced-motion: reduce) { .chat-msg, .chat-flash { animation: none !important; } }
`

function ChatImage({ path }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const hit = urlCache.get(path)
    let active = true
    if (hit && hit.exp > Date.now()) {
      const frame = requestAnimationFrame(() => {
        if (active) setUrl(hit.url)
      })
      return () => {
        active = false
        cancelAnimationFrame(frame)
      }
    }

    supabase.storage
      .from('photos')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (error) {
          console.error('Unable to create signed chat photo URL:', error)
          if (active) setFailed(true)
          return
        }
        if (data?.signedUrl) {
          urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
          if (active) setUrl(data.signedUrl)
        }
      })
      .catch((error) => {
        console.error('Unable to load chat photo:', error)
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [path, attempt])

  // an expired link fails to load: sign a fresh one once
  function onImageError() {
    if (attempt >= 1) return setFailed(true)
    urlCache.delete(path)
    setUrl('')
    setAttempt((count) => count + 1)
  }

  if (failed) {
    return <div className="rounded-2xl bg-[#0e0e10] p-4 text-sm text-red-300">Could not load photo.</div>
  }
  if (!url) return <div className="w-48 h-48 rounded-2xl bg-[#0e0e10] animate-pulse" />

  return (
    <img
      src={url}
      alt="Sent photo"
      onError={onImageError}
      onLoad={() => setAttempt(0)}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      className="max-w-full max-h-72 rounded-2xl cursor-pointer"
    />
  )
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  })
}

const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

function dayLabel(iso) {
  const key = dayKey(iso)
  if (key === dayKey(new Date().toISOString())) return 'Today'
  if (key === dayKey(new Date(Date.now() - 864e5).toISOString())) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila',
  })
}

function notifyMessage(payload) {
  supabase.functions
    .invoke('notify-message', { body: payload })
    .then(({ error }) => {
      if (error) console.error('Unable to send chat push notification:', error)
    })
    .catch((error) => console.error('Unable to send chat push notification:', error))
}

// swipe right = reply, long-press = menu, right-click = menu
function useBubbleGestures({ onReply, onMenu }) {
  const start = useRef(null)
  const timer = useRef(null)
  const clear = () => clearTimeout(timer.current)
  useEffect(() => clear, [])
  return {
    onTouchStart(event) {
      const touch = event.touches[0]
      start.current = { x: touch.clientX, y: touch.clientY }
      clear()
      timer.current = setTimeout(() => {
        start.current = null
        navigator.vibrate?.(15)
        onMenu()
      }, 450)
    },
    onTouchMove(event) {
      if (!start.current) return
      const touch = event.touches[0]
      if (Math.abs(touch.clientX - start.current.x) > 10 || Math.abs(touch.clientY - start.current.y) > 10) clear()
    },
    onTouchEnd(event) {
      clear()
      if (!start.current) return
      const touch = event.changedTouches[0]
      const dx = touch.clientX - start.current.x
      const dy = touch.clientY - start.current.y
      start.current = null
      if (dx > 70 && Math.abs(dy) < 40) onReply()
    },
    onContextMenu(event) {
      event.preventDefault()
      onMenu()
    },
  }
}

function Reactions({ list, me, onPick }) {
  const groups = {}
  list.forEach((reaction) => {
    const group = (groups[reaction.emoji] ||= { count: 0, mine: false })
    group.count += 1
    if (reaction.user_id === me) group.mine = true
  })
  const entries = Object.entries(groups)
  if (entries.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, group]) => (
        <button key={emoji} type="button" onClick={() => onPick(emoji)} className={`cb-chip ${group.mine ? 'on' : ''}`}>
          {emoji} {group.count > 1 ? group.count : ''}
        </button>
      ))}
    </div>
  )
}

function Bubble({ message, mine, original, authorName, snippet, reactions, me, flash, joinedTop, joinedBottom, onReply, onMenu, onReact, onJump }) {
  const gestures = useBubbleGestures({ onReply: () => onReply(message), onMenu: () => onMenu(message) })
  return (
    <div
      data-mid={message.id}
      style={joinedBottom ? { marginBottom: 2 } : undefined}
      className={`flex flex-col ${mine ? 'items-end' : 'items-start'} ${message._fresh ? 'chat-msg' : ''} ${flash ? 'chat-flash' : ''}`}
    >
      <div
        {...gestures}
        onDoubleClick={() => onReact(message, '❤️')}
        data-top={joinedTop ? 1 : 0}
        className={`chat-bubble ${mine ? 'cb-me' : 'cb-them'}`}
      >
        {message.reply_to && (
          <button type="button" onClick={() => onJump(message.reply_to)} className="cb-quote">
            {original ? (
              <>
                <span className="block font-semibold text-[var(--ac)]">{authorName(original)}</span>
                <span className="block truncate opacity-80">{snippet(original)}</span>
              </>
            ) : (
              <span className="opacity-70">Message unavailable</span>
            )}
          </button>
        )}
        {message.image_path && <ChatImage key={message.image_path} path={message.image_path} />}
        {message.body && <p className="break-words whitespace-pre-wrap">{message.body}</p>}
      </div>
      <Reactions list={reactions} me={me} onPick={(emoji) => onReact(message, emoji)} />
      {!joinedBottom && (
        <span className="text-[10px] text-[#b4b4be] mt-0.5 px-1">
          {formatTime(message.created_at)}
          {mine && (
            <span className="inline-flex items-center gap-0.5 align-middle">
              {' · '}
              {message.read_at ? <CheckCheck size={12} /> : <Check size={12} />}
              {message.read_at ? 'Seen' : 'Sent'}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

export default function Chat({ session }) {
  const me = session.user.id
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState([])
  const [names, setNames] = useState({})
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [menuMessage, setMenuMessage] = useState(null)
  const [flashId, setFlashId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const inputRef = useRef(null)
  const nearBottom = useRef(true)
  const markedRef = useRef(new Set())
  const messagesRef = useRef([])
  const sendingRef = useRef(false)
  const uploadingRef = useRef(false)
  const reactingRef = useRef(new Set())

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const loadReactions = useCallback(async (ids) => {
    if (!ids.length) return
    try {
      const { data, error: reactionError } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', ids)
      if (reactionError) throw reactionError
      setReactions((previous) => {
        const loadedIds = new Set(ids)
        return [...previous.filter((row) => !loadedIds.has(row.message_id)), ...(data || [])]
      })
    } catch (reactionError) {
      console.error('Unable to load reactions:', reactionError)
    }
  }, [])

  useEffect(() => {
    let active = true

    supabase
      .from('profiles')
      .select('id,name')
      .then(({ data, error: profilesError }) => {
        if (profilesError) throw profilesError
        if (active && data) setNames(Object.fromEntries(data.map((profile) => [profile.id, profile.name])))
      })
      .catch((profilesError) => {
        console.error('Unable to load chat profiles:', profilesError)
        if (active) setError('Could not load profile names.')
      })

    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          console.error('Unable to load chat messages:', loadError)
          setError('Could not load messages. Check the messages table and access policies.')
          return
        }
        const loadedMessages = (data || []).reverse()
        setMessages((previous) => {
          const byId = new Map(loadedMessages.map((message) => [message.id, message]))
          previous.forEach((message) => byId.set(message.id, message))
          return [...byId.values()].sort(
            (first, second) => new Date(first.created_at) - new Date(second.created_at),
          )
        })
        loadReactions(loadedMessages.map((message) => message.id))
      })
      .catch((loadError) => {
        console.error('Unable to load chat messages:', loadError)
        if (active) setError('Could not load messages. Check your network connection.')
      })

    const channel = supabase
      .channel('messages-room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new.sender !== me) play('bubble')
        setMessages((previous) =>
          previous.some((message) => message.id === payload.new.id)
            ? previous
            : [...previous, { ...payload.new, _fresh: true }],
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((previous) =>
          previous.map((message) => (message.id === payload.new.id ? { ...message, ...payload.new } : message)),
        )
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
        setReactions((previous) =>
          previous.some((row) => row.id === payload.new.id) ? previous : [...previous, payload.new],
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_reactions' }, (payload) => {
        setReactions((previous) => previous.map((row) => (row.id === payload.new.id ? payload.new : row)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        setReactions((previous) => previous.filter((row) => row.id !== payload.old.id))
      })
      .subscribe((status, subscribeError) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Chat realtime connection failed:', subscribeError)
          setError('Could not connect to live chat. Check Realtime settings for the messages table.')
        }
      })

    return () => {
      active = false
      supabase.removeChannel(channel).catch((channelError) => {
        console.error('Unable to remove chat realtime channel:', channelError)
      })
    }
  }, [loadReactions, me])

  // mark the other person's messages as seen, only once per message
  useEffect(() => {
    const unread = messages
      .filter((message) => message.sender !== me && !message.read_at && !markedRef.current.has(message.id))
      .map((message) => message.id)
    if (unread.length === 0) return
    unread.forEach((id) => markedRef.current.add(id))

    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('Unable to mark chat messages as read:', updateError)
          unread.forEach((id) => markedRef.current.delete(id))
          setError('Could not update message status. Check the UPDATE policy for the messages table.')
        }
      })
      .catch((updateError) => {
        console.error('Unable to mark chat messages as read:', updateError)
        unread.forEach((id) => markedRef.current.delete(id))
      })
  }, [messages, me])

  // only auto-scroll when you're already near the bottom (or you just sent something)
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (nearBottom.current || last?.sender === me) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, me])

  function onScroll(event) {
    const element = event.currentTarget
    nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120
  }

  const byId = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages])
  const reactionsByMessage = useMemo(() => {
    const map = {}
    reactions.forEach((row) => (map[row.message_id] ||= []).push(row))
    return map
  }, [reactions])

  const authorName = (message) => (message.sender === me ? 'You' : names[message.sender] || 'Partner')
  const snippet = (message) => (message.body ? message.body.slice(0, 80) : 'Photo')

  function jumpTo(id) {
    const element = scrollRef.current?.querySelector(`[data-mid="${id}"]`)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashId(id)
    setTimeout(() => setFlashId(null), 1300)
  }

  async function react(message, emoji) {
    if (reactingRef.current.has(message.id)) return
    reactingRef.current.add(message.id)
    const existing = reactions.find((row) => row.message_id === message.id && row.user_id === me)
    try {
      play('bubble')
      if (existing && existing.emoji === emoji) {
        setReactions((list) => list.filter((row) => row.id !== existing.id))
        const { error: removeError } = await supabase.from('message_reactions').delete().eq('id', existing.id)
        if (removeError) throw removeError
      } else if (existing) {
        setReactions((list) => list.map((row) => (row.id === existing.id ? { ...row, emoji } : row)))
        const { error: updateError } = await supabase.from('message_reactions').update({ emoji }).eq('id', existing.id)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await supabase
          .from('message_reactions')
          .insert({ message_id: message.id, user_id: me, emoji })
          .select()
          .single()
        if (insertError) throw insertError
        setReactions((list) => (list.some((row) => row.id === data.id) ? list : [...list, data]))
      }
    } catch (reactError) {
      console.error('Unable to save reaction:', reactError)
      setError('Could not save reaction.')
      loadReactions(messagesRef.current.map((item) => item.id))
    } finally {
      reactingRef.current.delete(message.id)
    }
  }

  async function sendText(event) {
    event.preventDefault()
    const body = text.trim()
    if (!body || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    setError('')
    try {
      const { error: sendError } = await supabase
        .from('messages')
        .insert({ sender: me, body, reply_to: replyTo?.id ?? null })
      if (sendError) {
        console.error('Unable to send chat message:', sendError)
        setError(`Could not send message: ${sendError.message}`)
        return
      }
      notifyMessage({ sender: me, text: body, has_image: false })
      play('pop')
      setText('')
      setReplyTo(null)
    } catch (sendError) {
      console.error('Unable to send chat message:', sendError)
      setError('Could not send message. Check your network connection.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  async function sendPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingRef.current) return
    if (!file.type.startsWith('image/')) {
      setError('Only image files can be sent.')
      return
    }

    uploadingRef.current = true
    setUploading(true)
    setError('')
    let path
    try {
      const blob = await compressImage(file)
      path = `chat/${me}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase
        .from('messages')
        .insert({ sender: me, image_path: path, reply_to: replyTo?.id ?? null })
      if (insertError) {
        const { error: removeError } = await supabase.storage.from('photos').remove([path])
        if (removeError) console.error('Unable to clean up unsent chat photo:', removeError)
        throw insertError
      }
      notifyMessage({ sender: me, has_image: true })
      play('pop')
      setReplyTo(null)
    } catch (uploadError) {
      console.error('Unable to send chat photo:', uploadError)
      setError(`Could not send photo: ${uploadError.message}`)
    } finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }

  const menuMine = menuMessage ? reactions.find((row) => row.message_id === menuMessage.id && row.user_id === me) : null

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <style>{STYLES}</style>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 chat-scroll">
        {messages.length === 0 && (
          <p className="text-center text-sm text-[#63636e] mt-10">No messages yet. Say hi!</p>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1]
          const next = messages[index + 1]
          const near = (a, b) =>
            a && b && a.sender === b.sender && Math.abs(new Date(b.created_at) - new Date(a.created_at)) < 5 * 60 * 1000
          const newDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at)
          return (
            <Fragment key={message.id}>
              {newDay && (
                <div className="text-center my-2">
                  <span className="chat-day">{dayLabel(message.created_at)}</span>
                </div>
              )}
              <Bubble
                message={message}
                mine={message.sender === me}
                original={message.reply_to ? byId.get(message.reply_to) : null}
                authorName={authorName}
                snippet={snippet}
                reactions={reactionsByMessage[message.id] || []}
                me={me}
                flash={flashId === message.id}
                joinedTop={!newDay && near(previous, message)}
                joinedBottom={near(message, next) && dayKey(next.created_at) === dayKey(message.created_at)}
                onReply={(target) => {
                  setReplyTo(target)
                  inputRef.current?.focus()
                }}
                onMenu={setMenuMessage}
                onReact={react}
                onJump={jumpTo}
              />
            </Fragment>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-center text-red-300 pb-1">{error}</p>}

      {replyTo && (
        <div className="cb-reply">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--ac)]">{authorName(replyTo)}</p>
            <p className="truncate text-[#9a9aa6]">{snippet(replyTo)}</p>
          </div>
          <button type="button" className="px-2 text-base" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
            <X size={18} />
          </button>
        </div>
      )}

      <form onSubmit={sendText} className="chat-bar">
        <input ref={fileRef} type="file" accept="image/*" onChange={sendPhoto} className="hidden" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="chat-round" aria-label="Send a photo">
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        </button>
        <input ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} placeholder="Type a message..." className="chat-pill" />
        <button type="submit" disabled={sending || !text.trim()} className="chat-round chat-send" aria-label="Send">
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={19} />}
        </button>
      </form>

      {menuMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuMessage(null)}
        >
          <div className="glass rounded-3xl p-3 space-y-2 w-72" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="text-2xl p-1.5 rounded-full"
                  style={menuMine?.emoji === emoji ? { background: 'rgba(230,201,168,.25)' } : undefined}
                  onClick={() => {
                    react(menuMessage, emoji)
                    setMenuMessage(null)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-3 text-left px-3 py-2 rounded-xl hover:bg-white/5"
              onClick={() => {
                setReplyTo(menuMessage)
                setMenuMessage(null)
                inputRef.current?.focus()
              }}
            >
              <Reply size={18} /> Reply
            </button>
            {menuMessage.body && (
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left px-3 py-2 rounded-xl hover:bg-white/5"
                onClick={() => {
                  navigator.clipboard?.writeText(menuMessage.body)
                  setMenuMessage(null)
                }}
              >
                <Copy size={18} /> Copy
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}