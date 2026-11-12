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


const TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'memories', label: 'Memories', icon: '📸' },
  { id: 'streak', label: 'Streak', icon: '🔥' },
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('chat')
  const [showSplash, setShowSplash] = useState(true)
  const [typing, setTyping] = useState(false)
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
    const isField = (element) =>
      element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')
    const onIn = (event) => {
      if (isField(event.target)) setTyping(true)
    }
    const onOut = (event) => {
      if (isField(event.relatedTarget)) return
      setTyping(false)
    }
    addEventListener('focusin', onIn)
    addEventListener('focusout', onOut)
    return () => {
      removeEventListener('focusin', onIn)
      removeEventListener('focusout', onOut)
    }
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
            {tab === 'chat' && <Chat session={session} />}
            {tab === 'memories' && <Memories session={session} />}
            {tab === 'streak' && <Streak session={session} />}
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
                  <span className="app-ico">{item.icon}</span>
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
      <Background soft={inside} />
      {view}
    </>
  )
}