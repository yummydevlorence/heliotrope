import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { compressImage } from '../lib/image'

const urlCache = new Map()

function ChatImage({ path }) {
  const [url, setUrl] = useState(urlCache.get(path) || '')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (urlCache.has(path)) return

    let active = true
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
          urlCache.set(path, data.signedUrl)
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
  }, [path])

  if (failed) {
    return <div className="rounded-2xl bg-[#0e0e10] p-4 text-sm text-red-300">Hindi ma-load ang photo.</div>
  }
  if (!url) return <div className="w-48 h-48 rounded-2xl bg-[#0e0e10] animate-pulse" />

  return (
    <img
      src={url}
      alt="Ipinadal na larawan"
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

export default function Chat({ session }) {
  const me = session.user.id
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    let active = true

    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          console.error('Unable to load chat messages:', loadError)
          setError('Hindi ma-load ang messages. Tingnan ang messages table at access policies.')
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
      })
      .catch((loadError) => {
        console.error('Unable to load chat messages:', loadError)
        if (active) setError('Hindi ma-load ang messages. Tingnan ang network connection.')
      })

    const channel = supabase
      .channel('messages-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((previous) =>
            previous.some((message) => message.id === payload.new.id)
              ? previous
              : [...previous, payload.new],
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === payload.new.id ? payload.new : message,
            ),
          )
        },
      )
      .subscribe((status, subscribeError) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Chat realtime connection failed:', subscribeError)
          setError('Hindi makakonekta sa live chat. Tingnan ang Realtime settings ng messages table.')
        }
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const unread = messages
      .filter((message) => message.sender !== me && !message.read_at)
      .map((message) => message.id)
    if (unread.length === 0) return

    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error('Unable to mark chat messages as read:', updateError)
          setError('Hindi ma-update ang seen status. Tingnan ang UPDATE policy ng messages table.')
        }
      })
      .catch((updateError) => {
        console.error('Unable to mark chat messages as read:', updateError)
        setError('Hindi ma-update ang seen status. Tingnan ang network connection.')
      })
  }, [messages, me])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendText(event) {
    event.preventDefault()
    const body = text.trim()
    if (!body || sending) return

    setSending(true)
    setError('')
    try {
      const { error: sendError } = await supabase.from('messages').insert({ sender: me, body })
      if (sendError) {
        console.error('Unable to send chat message:', sendError)
        setError('Hindi na-send ang message. Tingnan ang INSERT policy ng messages table.')
        return
      }
      setText('')
    } catch (sendError) {
      console.error('Unable to send chat message:', sendError)
      setError('Hindi na-send ang message. Tingnan ang network connection.')
    } finally {
      setSending(false)
    }
  }

  async function sendPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Image file lang ang puwedeng ipadala.')
      return
    }

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
        .insert({ sender: me, image_path: path })
      if (insertError) {
        const { error: removeError } = await supabase.storage.from('photos').remove([path])
        if (removeError) console.error('Unable to clean up unsent chat photo:', removeError)
        throw insertError
      }
    } catch (uploadError) {
      console.error('Unable to send chat photo:', uploadError)
      setError('Hindi na-send ang photo. Tingnan ang photos bucket at upload permissions.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-14rem)] min-h-[320px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-[#63636e] mt-10">
            Wala pang message. Mag-hi ka na! 💕
          </p>
        )}
        {messages.map((message) => {
          const mine = message.sender === me
          return (
            <div
              key={message.id}
              className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  mine ? 'bg-[#3e3e45]' : 'bg-[#0e0e10]'
                }`}
              >
                {message.image_path && <ChatImage path={message.image_path} />}
                {message.body && (
                  <p className="break-words whitespace-pre-wrap">{message.body}</p>
                )}
              </div>
              <span className="text-[10px] text-[#63636e] mt-0.5 px-1">
                {formatTime(message.created_at)}
                {mine && (message.read_at ? ' · ✓✓ Seen' : ' · ✓ Sent')}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-xs text-center text-red-300 pb-1">{error}</p>}

      <form onSubmit={sendText} className="flex items-center gap-2 p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={sendPhoto}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="glass-btn !px-3 !py-2 text-xl"
          aria-label="Magpadala ng larawan"
        >
          {uploading ? '⏳' : '📷'}
        </button>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Mag-message..."
          className="glass-input"
        />
        <button type="submit" disabled={sending || !text.trim()} className="glass-btn !px-4">
          {sending ? '…' : '➤'}
        </button>
      </form>
    </div>
  )
}
