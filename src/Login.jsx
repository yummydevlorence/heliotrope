import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const USERS = [
  { name: import.meta.env.VITE_USER1_NAME, email: import.meta.env.VITE_USER1_EMAIL },
  { name: import.meta.env.VITE_USER2_NAME, email: import.meta.env.VITE_USER2_EMAIL },
]

function greeting() {
  const hour = Number(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }),
  )
  if (hour < 12) return { text: 'Good morning, love', icon: '☀️' }
  if (hour < 18) return { text: 'Good afternoon, love', icon: '🌤️' }
  return { text: 'Good evening, love', icon: '🌙' }
}

const rand = (min, max) => Math.random() * (max - min) + min
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const PETAL_ANGLES = Array.from({ length: 16 }, (_, index) => index * 22.5)
const SEEDS = Array.from({ length: 46 }, (_, index) => {
  const radius = Math.sqrt((index + 0.5) / 46) * 15
  const angle = index * 2.39996
  return { x: +(Math.cos(angle) * radius).toFixed(1), y: +(Math.sin(angle) * radius).toFixed(1) }
})

function Sunflower({ svgRef, faceRef }) {
  return (
    <svg ref={svgRef} className="auth-sf" viewBox="-50 -50 100 100" aria-hidden="true">
      <g className="auth-head">
        {PETAL_ANGLES.map((angle, index) => (
          <g key={`back-${index}`} transform={`rotate(${angle + 11.25})`}>
            <g className="auth-pt" style={{ animationDelay: `${0.45 + index * 0.045}s` }}>
              <ellipse cx="33" rx="19" ry="7" fill="#b9791a" />
            </g>
          </g>
        ))}
        {PETAL_ANGLES.map((angle, index) => (
          <g key={`front-${index}`} transform={`rotate(${angle})`}>
            <g className="auth-pt" style={{ animationDelay: `${0.7 + index * 0.045}s` }}>
              <ellipse cx="31" rx="19" ry="7.5" fill="#f0b83a" />
            </g>
          </g>
        ))}
        <g ref={faceRef} className="auth-face">
          <circle r="18" fill="#2b1709" />
          {SEEDS.map((seed, index) => (
            <circle key={index} cx={seed.x} cy={seed.y} r="1.1" fill="#7a5226" />
          ))}
        </g>
      </g>
    </svg>
  )
}

export default function Login() {
  const [selected, setSelected] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [hello] = useState(greeting)

  const canvasRef = useRef(null)
  const sunRef = useRef(null)
  const faceRef = useRef(null)
  const particles = useRef([])
  const aim = useRef({ x: 0, y: 0 })

  function look() {
    const face = faceRef.current
    if (!face) return
    const { x, y } = aim.current
    const distance = Math.hypot(x, y) || 1
    const strength = Math.min(distance / 120, 1) * 4
    face.style.transform = `translate(${((x / distance) * strength).toFixed(2)}px,${((y / distance) * strength).toFixed(2)}px)`
  }

  // the sunflower's face follows the pointer
  useEffect(() => {
    function onMove(event) {
      const face = faceRef.current
      if (!face) return
      const box = face.getBoundingClientRect()
      aim.current = {
        x: event.clientX - (box.left + box.width / 2),
        y: event.clientY - (box.top + box.height / 2),
      }
      look()
    }
    addEventListener('pointermove', onMove)
    return () => removeEventListener('pointermove', onMove)
  }, [])

  // sun glow, drifting petals and pollen bursts inside the card
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const startTime = performance.now()
    let frame = 0

    function draw(now) {
      const pixelRatio = Math.min(devicePixelRatio || 1, 2)
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
        canvas.width = Math.round(width * pixelRatio)
        canvas.height = Math.round(height * pixelRatio)
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)

      const time = (now - startTime) / 1000
      const list = particles.current

      const sun = sunRef.current?.getBoundingClientRect()
      const box = canvas.getBoundingClientRect()
      if (sun) {
        const glowX = sun.left - box.left + sun.width / 2
        const glowY = sun.top - box.top + sun.height / 2
        const glowIn = clamp(time / 1.8, 0, 1)
        const pulse = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 1.6)
        const glow = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, 150)
        glow.addColorStop(0, `rgba(255,200,130,${(0.32 * glowIn * pulse).toFixed(3)})`)
        glow.addColorStop(1, 'rgba(255,200,130,0)')
        context.fillStyle = glow
        context.fillRect(0, 0, width, height)
      }

      if (!reduceMotion && time > 1.5 && Math.random() < 0.04) {
        if (list.filter((particle) => particle.kind === 'petal').length < 9) {
          list.push({
            kind: 'petal',
            x: rand(0, width),
            y: -10,
            vy: rand(0.35, 0.7),
            size: rand(4, 7),
            phase: rand(0, 6.28),
            rotation: rand(0, 6.28),
            spin: rand(-0.02, 0.02),
            life: 1,
          })
        }
      }

      for (const particle of list) {
        context.save()
        context.translate(particle.x, particle.y)
        if (particle.kind === 'petal') {
          particle.y += particle.vy
          particle.x += Math.sin(time * 1.1 + particle.phase) * 0.5
          particle.rotation += particle.spin
          context.rotate(particle.rotation)
          context.globalAlpha = 0.55
          context.fillStyle = '#e6b54a'
          context.beginPath()
          context.ellipse(0, 0, particle.size, particle.size * 0.38, 0, 0, Math.PI * 2)
          context.fill()
          if (particle.y > height + 12) particle.life = 0
        } else {
          particle.x += particle.vx
          particle.y += particle.vy
          particle.vy += 0.05
          particle.vx *= 0.98
          particle.life -= 0.016
          particle.rotation += particle.spin
          context.rotate(particle.rotation)
          context.globalAlpha = Math.max(0, particle.life)
          context.fillStyle = '#f5d27a'
          context.beginPath()
          context.ellipse(0, 0, particle.size, particle.size * 0.45, 0, 0, Math.PI * 2)
          context.fill()
        }
        context.restore()
      }
      particles.current = list.filter((particle) => particle.life > 0)

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  function burst(button) {
    const canvas = canvasRef.current
    if (!canvas) return
    const box = canvas.getBoundingClientRect()
    const rect = button.getBoundingClientRect()
    const x = rect.left - box.left + rect.width / 2
    const y = rect.top - box.top + 20
    for (let index = 0; index < 18; index += 1) {
      const angle = rand(0, 6.28)
      const speed = rand(1, 3)
      particles.current.push({
        kind: 'burst',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        size: rand(1.5, 3.2),
        rotation: rand(0, 6),
        spin: rand(-0.2, 0.2),
        life: 1,
      })
    }
  }

  function choose(user, event) {
    const button = event.currentTarget
    burst(button)
    const face = faceRef.current?.getBoundingClientRect()
    if (face) {
      const rect = button.getBoundingClientRect()
      aim.current = {
        x: rect.left + rect.width / 2 - (face.left + face.width / 2),
        y: rect.top - (face.top + face.height / 2),
      }
      look()
    }
    setSelected(user)
    setPassword('')
    setError('')
    setInfo('')
  }

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: selected.email,
      password,
    })
    if (loginError) {
      console.error('Supabase login error:', loginError.message)
      setError(loginError.message)
      setShake(true)
    }
    setLoading(false)
  }

  async function handleForgot() {
    setLoading(true)
    setError('')
    setInfo('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(selected.email, {
      redirectTo: window.location.origin,
    })
    if (resetError) {
      setError('Could not send the email. Try again later.')
      setShake(true)
    } else setInfo('Sent! Check your inbox (and spam).')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="auth-wrap">
        <form
          onSubmit={handleLogin}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setShake(false)
          }}
          className={`auth-card ${shake ? 'shake' : ''}`}
        >
          <canvas ref={canvasRef} className="auth-fx" aria-hidden="true" />

          <div className="auth-ct space-y-4">
            <div className="text-center">
              <Sunflower svgRef={sunRef} faceRef={faceRef} />
              <h1 className="auth-title" aria-label={`${hello.text} ${hello.icon}`}>
                {[...hello.text].map((letter, index) => (
                  <span key={index} aria-hidden="true" style={{ animationDelay: `${1 + index * 0.04}s` }}>
                    {letter}
                  </span>
                ))}
                <span aria-hidden="true" style={{ animationDelay: `${1 + hello.text.length * 0.04}s` }}>
                  {' '}
                  {hello.icon}
                </span>
              </h1>
              <span className="auth-underline" />
              <p
                className="auth-in text-sm text-[#9a9aa6] mt-3 mb-2"
                style={{ animationDelay: '1.9s' }}
              >
                the wrong answer that led me to you
              </p>
            </div>

            <p className="auth-in text-xs text-[#63636e]" style={{ animationDelay: '2.05s' }}>
              Sino ka?
            </p>
            <div className="auth-in flex gap-3" style={{ animationDelay: '2.15s' }}>
              {USERS.map((user) => (
                <button
                  type="button"
                  key={user.email}
                  onClick={(event) => choose(user, event)}
                  className={`auth-user ${selected?.email === user.email ? 'sel' : ''}`}
                >
                  <span className="auth-av">{user.name?.[0]}</span>
                  <span>{user.name}</span>
                </button>
              ))}
            </div>

            {selected && (
              <div className="auth-panel-in">
                <div className="auth-panel-inner space-y-4">
                  <div className="auth-field">
                    <input
                      type="password"
                      placeholder="Password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      className="auth-input"
                    />
                  </div>

                  {error && <p className="auth-err text-sm text-center text-red-300">{error}</p>}
                  {info && <p className="text-sm text-center text-green-300">{info}</p>}

                  <button disabled={loading} className="auth-btn">
                    {loading ? <span className="auth-spin" /> : 'Login'}
                  </button>

                  <button type="button" onClick={handleForgot} disabled={loading} className="auth-link">
                    Forgot password?
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}