import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Background from './Background'
import Header from './Header'
import Splash from './Splash'
import Login from './Login'
import ResetPassword from './ResetPassword'
import Chat from './pages/Chat'
import Memories from './pages/Memories'
import Streak from './pages/Streak'
import Alarms from './pages/alarm'
import Locator from './pages/locator'

function MessageCircleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></svg>
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h-4L8 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3Z" /><circle cx="12" cy="13" r="3" /></svg>
}

function FlameIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 14.5A4.5 4.5 0 0 0 12 22a5 5 0 0 0 5-5c0-3.5-2.5-5-3-9-2 2-3 3-3 6-1.5-.5-2.5-2-2-4-2 1.5-3 3.5-3 6" /><path d="M12 22a3 3 0 0 0 3-3c0-1.5-1-2.5-2-3.5-.5 1.5-1 2-2 2.5a3 3 0 0 0 1 4Z" /></svg>
}

function AlarmClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M5 3 2 6m17-3 3 3M6.5 19.5 5 21m12.5-1.5L19 21" /></svg>
}

function MapPinIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
}

const TABS = [
  { id: 'chat', label: 'Chat', Icon: MessageCircleIcon },
  { id: 'memories', label: 'Memories', Icon: CameraIcon },
  { id: 'streak', label: 'Streak', Icon: FlameIcon },
  { id: 'alarms', label: 'Alarms', Icon: AlarmClockIcon },
  { id: 'locator', label: 'Locator', Icon: MapPinIcon },
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('chat')
  const [showSplash, setShowSplash] = useState(true)
  const [typing, setTyping] = useState(false)
  const [documentHidden, setDocumentHidden] = useState(document.hidden)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(currentSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const isField = (el) =>
      el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'file'
    let timer
    const onIn = (event) => {
      clearTimeout(timer)
      if (isField(event.target)) setTyping(true)
    }
    const onOut = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setTyping(isField(document.activeElement)), 100)
    }
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => setDocumentHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // login keeps the bright photo wall; the app screens get the calmer one
  const inside = !showSplash && Boolean(session) && !recovering

  let view
  if (showSplash) {
    view = <Splash onDone={() => setShowSplash(false)} />
  } else if (session === undefined) {
    view = <div className="min-h-screen flex items-center justify-center text-4xl">🌻</div>
  } else if (recovering) {
    view = <ResetPassword onDone={() => setRecovering(false)} />
  } else if (!session) {
    view = <Login />
  } else {
    view = (
      <div className="app-shell">
        <Header session={session} />

        <main className="app-main">
          <div className="app-page">
            <div key={tab} className="tab-fade">
              {tab === 'chat' && <Chat session={session} />}
              {tab === 'memories' && <Memories session={session} />}
              {tab === 'streak' && <Streak session={session} />}
              {tab === 'alarms' && <Alarms session={session} />}
              {tab === 'locator' && <Locator session={session} />}
            </div>
          </div>
        </main>

        {!typing && (
          <nav className="app-nav">
            <div className="app-tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`app-tab ${tab === item.id ? 'on' : ''}`}
                >
                  <span className="app-ico"><item.Icon /></span>
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>
    )
  }

  return (
    <>
      <Background soft={inside} paused={typing || documentHidden} />
      {view}
    </>
  )
}