import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { play } from '../Sfx.js'
import { ART_STYLES, Cat, RoomIcon, Scene, StatIcon } from './PetArt'

const STYLES = `
@keyframes pt-float { from { opacity: 1; transform: translateY(0) scale(.8); } to { opacity: 0; transform: translateY(-70px) scale(1.2); } }
@keyframes pt-z { 0% { opacity: 0; transform: translate(0, 0); } 40% { opacity: 1; } 100% { opacity: 0; transform: translate(14px, -22px); } }
@keyframes pt-jig { 0%, 100% { transform: translateY(0) rotate(0); } 35% { transform: translateY(-16px) rotate(-3deg); } 65% { transform: translateY(0) rotate(2deg); } }
@keyframes pt-fall { 0% { top: 22%; opacity: 0; } 12% { opacity: .95; } 100% { top: 91%; opacity: .15; } }
@keyframes pt-run { 0%, 100% { transform: translateY(0) rotate(calc(var(--lean, 0) * 1deg)); } 50% { transform: translateY(-10px) rotate(calc(var(--lean, 0) * 1deg)); } }
@keyframes pt-ping { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,.75); } 100% { box-shadow: 0 0 0 16px rgba(255,255,255,0); } }
@keyframes pt-bob { to { transform: translateY(-4px); } }
.pt-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 2px 4px 12px; }
.pt-ico { display: flex; align-items: center; justify-content: center; height: 30px; margin-bottom: 4px; }
.pt-ico img { width: 28px; height: 28px; object-fit: contain; }
.pt-ico.alert { animation: pt-wiggle .8s ease-in-out infinite; }
@keyframes pt-wiggle { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
.pt-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
.pt-tab { border: 0; border-radius: 12px; padding: 8px 0; font-size: 12px; background: #0e0e10; color: #9a9aa6; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; transition: background .3s, color .3s; }
.pt-tab.on { background: var(--ac); color: #0e0e10; font-weight: 600; }
.pt-stage { position: relative; width: 100%; max-width: 440px; margin: 0 auto; aspect-ratio: 6 / 5; border-radius: 22px; overflow: hidden; background: #0e0e10; box-shadow: 0 6px 18px rgba(0,0,0,.45); user-select: none; }
.pt-props { position: absolute; inset: 0; pointer-events: none; animation: pt-fade .4s ease both; }
.pt-props > * { pointer-events: auto; }
.pt-prop { position: absolute; border: 0; background: transparent; font-size: 2.2rem; line-height: 1; cursor: pointer; padding: 4px; }
.pt-prop:disabled { opacity: .35; cursor: default; }
.pt-hit { position: absolute; transform: translate(-50%, -50%); width: 46px; height: 46px; border: 0; border-radius: 50%; background: transparent; cursor: pointer; padding: 0; }
.pt-hit.hot { animation: pt-ping 1.5s ease-out infinite; }
.pt-pill { position: absolute; left: 10px; top: 10px; z-index: 3; background: rgba(255,255,255,.85); color: #3b2a3f; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.pt-hint { position: absolute; left: 10px; top: 44px; z-index: 3; max-width: 62%; background: rgba(255,255,255,.82); color: #4a4155; font-size: 11px; padding: 4px 10px; border-radius: 10px; pointer-events: none; }
.pt-catbox { position: absolute; z-index: 2; width: 52%; aspect-ratio: 1; left: 24%; bottom: 7%; touch-action: none; cursor: grab; transition: left .7s cubic-bezier(.22, 1, .36, 1), bottom .7s cubic-bezier(.22, 1, .36, 1), width .7s cubic-bezier(.22, 1, .36, 1); }
.pt-catbox.awake-bed { left: 48%; width: 46%; }
.pt-catbox.onbed { left: 8%; bottom: 39%; width: 44%; cursor: pointer; }
.pt-catbox.in-bath { left: 30%; width: 42%; }
.pt-catbox.in-shower { left: 1%; bottom: 6%; width: 38%; }
.pt-catbox.on-toilet { left: 66%; bottom: 41%; width: 34%; }
.pt-catbox.playing { bottom: 6%; width: 40%; transition: width .5s cubic-bezier(.22, 1, .36, 1), bottom .5s cubic-bezier(.22, 1, .36, 1); }
.pt-catbox[data-run="1"] .pt-lift { animation: pt-run .32s ease-in-out infinite; }
.pt-wet .pt-lift { filter: brightness(.86) saturate(.9); }
.pt-lift { width: 100%; height: 100%; }
.pt-jig { animation: pt-jig .6s ease-in-out; }
.pt-heart { position: absolute; top: 12%; pointer-events: none; animation: pt-float .9s ease-out forwards; }
.pt-z { animation: pt-z 2.4s ease-in-out infinite; }
.pt-dark { position: absolute; inset: 0; z-index: 4; background: rgba(4, 6, 18, .55); pointer-events: none; animation: pt-fade .8s ease both; }
.pt-drop { position: absolute; z-index: 3; width: 3px; height: 13px; border-radius: 3px; background: linear-gradient(#d6f1fd, #6bbbe6); pointer-events: none; animation: pt-fall .65s linear infinite; }
.pt-foam { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; transition: opacity 1.6s ease; }
.pt-need { position: absolute; right: -4%; top: -2%; z-index: 3; background: #fff; color: #3b2a3f; font-size: 13px; font-weight: 600; padding: 3px 9px; border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,.25); pointer-events: none; animation: pt-bob 1.4s ease-in-out infinite alternate; }
.pt-toys { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none; touch-action: none; }
.pt-bar { height: 6px; border-radius: 6px; background: #0e0e10; overflow: hidden; }
.pt-bar > span { display: block; height: 100%; border-radius: 6px; background: var(--ac); transition: width .6s ease; }
.pt-bar.low > span { background: #f08a7e; }
@media (prefers-reduced-motion: reduce) { .pt-ico.alert, .pt-z, .pt-jig, .pt-props, .pt-dark, .pt-hit.hot, .pt-need, .pt-catbox[data-run="1"] .pt-lift { animation: none !important; } .pt-drop { animation-duration: 1.4s; } }
`

const ROOMS = {
  kitchen: { label: 'Kitchen', icon: '🍽️' },
  bed: { label: 'Bedroom', icon: '🛏️' },
  bath: { label: 'Bathroom', icon: '🛁' },
  play: { label: 'Playroom', icon: '🧸' },
}
const STATS = [
  ['food', 'Food'],
  ['clean', 'Shower'],
  ['toilet', 'Toilet'],
  ['energy', 'Energy'],
  ['joy', 'Joy'],
]

// Want your own pictures? Drop food / clean / toilet / energy / joy (.png .webp .svg)
// into <project>/img/stats/ and they replace the drawn icons automatically.
const STAT_IMAGES = import.meta.glob('../../img/stats/*.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const statImage = (key) =>
  Object.entries(STAT_IMAGES).find(([path]) => path.split('/').pop().split('.')[0] === key)?.[1]

const WAKE_MIN = 30 // can't wake the cat while energy is below this
const SLEEP_MAX = 90 // too awake to fall asleep above this

// every stat is stored as { v: value, t: time saved } and drifts per hour from there
const RATE = { food: -4, clean: -35, energy: -3, joy: -3 } // clean: ~1h dirty, ~2h super dirty
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const rateOf = (key, data) => (key === 'energy' && data.asleep ? 25 : RATE[key])
const at = (data, key, time = Date.now()) =>
  clamp(data[key].v + (rateOf(key, data) * (time - data[key].t)) / 36e5)
// toilet is how badly he needs to go (full = bad); the rest are 100 = good
const level = (data, key) => {
  if (key === 'toilet') {
    if (data.poops > 0) return 100
    const left = (data.nextPoop || Date.now() + 36e5) - Date.now()
    return clamp(100 * (1 - left / 36e5))
  }
  return key === 'clean' ? clamp(at(data, key) - data.poops * 8) : at(data, key)
}

// next poop comes 40 to 80 minutes later
const randomGap = () => (40 + Math.random() * 40) * 60000
const MAX_POOPS = 3

function fresh() {
  const t = Date.now()
  return {
    food: { v: 60, t },
    clean: { v: 80, t },
    energy: { v: 80, t },
    joy: { v: 70, t },
    asleep: false,
    poops: 0,
    nextPoop: t + randomGap(),
    ate: { date: '', n: 0 },
  }
}

function settle(data) {
  const t = Date.now()
  const next = { ...data }
  for (const key of Object.keys(RATE)) next[key] = { v: at(data, key, t), t }
  return next
}

/* ---------- bathroom ---------- */

// lather blobs on the cat (200x200 cat art space), revealed as you scrub
const FOAM = [
  [70, 48, 14], [128, 44, 13], [100, 30, 12], [56, 86, 13], [146, 88, 12], [100, 70, 15],
  [78, 112, 13], [122, 112, 13], [60, 150, 16], [142, 150, 15], [100, 140, 16], [88, 176, 14],
  [120, 176, 13], [44, 120, 10], [158, 122, 10], [100, 100, 12],
]
const DROPS = [14.8, 16.2, 17.6, 19, 20.4, 21.8, 23.2]

/* ---------- playroom physics (scene units: the 360x300 room) ---------- */

const SW = 360
const SH = 300
const FLOOR = 282
const KEYS = ['ball', 'yarn']
const TOY = {
  ball: { r: 12, bounce: 0.62, drag: 0.9 },
  yarn: { r: 13, bounce: 0.3, drag: 2.4 },
}
const makeToys = () => ({
  ball: { x: 96, h: 0, vx: 0, vh: 0, rot: 0, held: false },
  yarn: {
    x: 262, h: 0, vx: 0, vh: 0, rot: 0, held: false,
    trail: [[228, 270], [237, 273], [246, 270], [255, 272]],
  },
})
const INITIAL_TOYS = makeToys()
const makeBrain = () => ({ x: 180, vx: 0, state: 'idle', timer: 0, chain: 0, alert: 0, hold: null, dir: 1, engaged: false })
const toyY = (key, toy) => FLOOR - TOY[key].r - toy.h
const toyTransform = (key, toy) => `translate(${toy.x.toFixed(1)} ${toyY(key, toy).toFixed(1)})`
const threadPoints = (toy) =>
  [...toy.trail, [toy.x, FLOOR - TOY.yarn.r - toy.h]].map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const capSpeed = (value) => clamp(value, -650, 650)
const randomValue = () => Math.random()
const currentTime = () => Date.now()
const monotonicTime = () => performance.now()

export default function Pet({ mealsToday, today }) {
  const [pet, setPet] = useState(null)
  const [name, setName] = useState('Heli')
  const [room, setRoom] = useState('kitchen')
  const [msg, setMsg] = useState('')
  const [hearts, setHearts] = useState([])
  const [jig, setJig] = useState(false)
  const [chew, setChew] = useState(false)
  const [potty, setPotty] = useState(null) // null | 'go' | 'done' | 'flush'
  const [shower, setShower] = useState('off') // 'off' | 'on' | 'rinse'
  const [suds, setSuds] = useState(0)
  const [engaged, setEngaged] = useState(false) // cat is chasing / holding a toy
  const [, setTick] = useState(0)
  const petRef = useRef(null)
  const rub = useRef({ on: false, x: 0, y: 0, dist: 0 })
  const lastPet = useRef(0)
  const msgTimer = useRef(0)
  const pottyTimer = useRef(0)
  const sudsRef = useRef(0)
  const rinsing = useRef(false)
  const stageRef = useRef(null)
  const toysRef = useRef(makeToys())
  const brainRef = useRef(makeBrain())
  const drag = useRef({ samples: [] })
  const catches = useRef(0)
  const rewardTimer = useRef(0)
  const api = useRef({})

  useEffect(() => {
    let active = true
    const apply = (row) => {
      if (!active || !row) return
      const data = row.data?.food ? row.data : fresh()
      petRef.current = data
      setPet(data)
      setName(row.name || 'Heli')
    }
    supabase
      .from('pet')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error) {
          console.error('Unable to load pet:', error)
          setMsg('Could not load the cat. Check the pet table and policies.')
          return
        }
        if (data) {
          apply(data)
          setTimeout(() => api.current.checkPoop?.(), 800)
          return
        }
        const row = { id: 1, name: 'Heli', data: fresh() }
        await supabase.from('pet').insert(row)
        apply(row)
      })
    const channel = supabase
      .channel('pet-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pet' }, (payload) => apply(payload.new))
      .subscribe()
    const timer = setInterval(() => {
      setTick((n) => n + 1)
      api.current.checkPoop?.()
    }, 30000)
    return () => {
      active = false
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  // Playroom: toy physics + the cat chasing, catching and batting them around.
  useEffect(() => {
    if (room !== 'play') return
    const toys = toysRef.current
    const brain = brainRef.current
    const stage = stageRef.current
    if (!stage) return
    const els = Object.fromEntries(
      [...stage.querySelectorAll('[data-toy]')].map((element) => [element.dataset.toy, element]),
    )
    let frame = 0
    let last = performance.now()

    function draw() {
      for (const key of KEYS) {
        const toy = toys[key]
        const r = TOY[key].r
        els[`${key}G`]?.setAttribute('transform', toyTransform(key, toy))
        els[`${key}Spin`]?.setAttribute('transform', `rotate(${toy.rot.toFixed(1)})`)
        const shadow = els[`${key}Shadow`]
        if (shadow) {
          shadow.setAttribute('cx', toy.x.toFixed(1))
          shadow.setAttribute('rx', (r * (1 - Math.min(toy.h, 200) / 260)).toFixed(1))
        }
      }
      const points = threadPoints(toys.yarn)
      els.threadA?.setAttribute('points', points)
      els.threadB?.setAttribute('points', points)
    }

    function physics(dt) {
      for (const key of KEYS) {
        const toy = toys[key]
        const spec = TOY[key]
        if (toy.held || brain.hold === key) continue
        toy.vh -= 900 * dt
        toy.h += toy.vh * dt
        if (toy.h <= 0) {
          toy.h = 0
          toy.vh = toy.vh < -80 ? -toy.vh * spec.bounce : 0
        } else if (toy.h > 240) {
          toy.h = 240
          toy.vh = -Math.abs(toy.vh) * 0.3
        }
        toy.x += toy.vx * dt
        toy.vx *= Math.exp(-(toy.h === 0 ? spec.drag : 0.15) * dt)
        if (toy.x < spec.r) {
          toy.x = spec.r
          toy.vx = Math.abs(toy.vx) * 0.7
        } else if (toy.x > SW - spec.r) {
          toy.x = SW - spec.r
          toy.vx = -Math.abs(toy.vx) * 0.7
        }
        if (toy.h === 0 && Math.abs(toy.vx) < 3) toy.vx = 0
        toy.rot += ((toy.vx * dt) / spec.r) * (180 / Math.PI)
      }

      // the yarn leaves a thread behind it
      const yarn = toys.yarn
      const y = toyY('yarn', yarn)
      const tail = yarn.trail[yarn.trail.length - 1]
      if (!tail || Math.hypot(yarn.x - tail[0], y - tail[1]) > 9) {
        yarn.trail.push([yarn.x, y])
        if (yarn.trail.length > 18) yarn.trail.shift()
      }
    }

    function think(dt) {
      const pet = petRef.current
      const catEl = stage.querySelector('.pt-catbox')
      let wantEngaged = false

      if (pet && !pet.asleep && catEl) {
        const energy = level(pet, 'energy')
        const free = KEYS.filter((key) => !toys[key].held)
        brain.timer -= dt
        brain.alert = Math.max(0, brain.alert - dt)

        // someone grabbed the toy out of the cat's paws
        if (brain.hold && toys[brain.hold].held) {
          brain.hold = null
          brain.state = 'idle'
        }

        if (brain.state === 'idle') {
          brain.vx *= Math.exp(-9 * dt)
          const moving = free.some((key) => Math.abs(toys[key].vx) > 40 || toys[key].h > 4)
          if (energy >= 15 && free.length && brain.chain < 3 && (brain.alert > 0 || moving)) brain.state = 'chase'
        } else if (brain.state === 'recover') {
          brain.vx *= Math.exp(-9 * dt)
          if (brain.timer <= 0) brain.state = 'chase'
        }

        if (brain.state === 'chase') {
          if (!free.length || energy < 15) {
            brain.state = 'idle'
          } else {
            const key = free.reduce((a, b) => (Math.abs(toys[b].x - brain.x) < Math.abs(toys[a].x - brain.x) ? b : a))
            const toy = toys[key]
            const dx = toy.x + toy.vx * 0.2 - brain.x
            brain.vx += (clamp(dx * 6, -250, 250) - brain.vx) * Math.min(1, dt * 9)
            brain.x = clamp(brain.x + brain.vx * dt, 40, 320)
            brain.dir = Math.sign(toy.x - brain.x) || brain.dir
            if (Math.abs(toy.x - brain.x) < 30 && toy.h < 40) {
              brain.state = 'hold'
              brain.hold = key
              brain.timer = 0.9
              brain.vx = 0
              toy.vx = 0
              toy.vh = 0
              api.current.caught?.()
            }
          }
        }

        if (brain.state === 'hold' && brain.hold) {
          const toy = toys[brain.hold]
          toy.x = clamp(brain.x + brain.dir * 30, 12, SW - 12)
          toy.h = 8 + Math.abs(Math.sin(brain.timer * 14)) * 7
          toy.rot += brain.dir * 400 * dt
          if (brain.timer <= 0) {
            const away = brain.x > 250 ? -1 : brain.x < 110 ? 1 : Math.random() < 0.5 ? -1 : 1
            toy.vx = away * (170 + Math.random() * 130)
            toy.vh = 130 + Math.random() * 140
            brain.hold = null
            brain.dir = away
            brain.chain += 1
            brain.state = brain.chain >= 3 ? 'idle' : 'recover'
            brain.timer = 0.35
            api.current.batted?.()
          }
        }

        wantEngaged = brain.state === 'chase' || brain.state === 'hold' || brain.state === 'recover'
        catEl.style.left = `${((brain.x - 72) / 3.6).toFixed(2)}%`
        catEl.dataset.run = Math.abs(brain.vx) > 35 ? '1' : '0'
        catEl.style.setProperty('--lean', clamp(brain.vx / 45, -6, 6).toFixed(1))
      }

      if (brain.engaged !== wantEngaged) {
        brain.engaged = wantEngaged
        api.current.engage?.(wantEngaged)
      }
    }

    function frameLoop(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      physics(dt)
      think(dt)
      draw()
      frame = requestAnimationFrame(frameLoop)
    }

    draw()
    frame = requestAnimationFrame(frameLoop)

    return () => {
      cancelAnimationFrame(frame)
      const catEl = stage.querySelector('.pt-catbox')
      if (catEl) {
        catEl.style.left = ''
        catEl.dataset.run = '0'
        catEl.style.removeProperty('--lean')
      }
      brain.state = 'idle'
      brain.hold = null
      brain.vx = 0
      brain.engaged = false
      api.current.engage?.(false)
    }
  }, [room])

  const say = useCallback((text) => {
    setMsg(text)
    clearTimeout(msgTimer.current)
    msgTimer.current = setTimeout(() => setMsg(''), 2600)
  }, [])

  const save = useCallback(async (change) => {
    const next = change(settle(petRef.current))
    petRef.current = next
    setPet(next)
    const { error } = await supabase.from('pet').update({ data: next }).eq('id', 1)
    if (error) {
      console.error('Unable to save pet:', error)
      say('Could not save. Check the pet table policies.')
    }
  }, [say])

  const addHeart = useCallback(() => {
    const id = randomValue()
    const x = 30 + randomValue() * 40
    setHearts((list) => [...list, { id, x }])
    setTimeout(() => setHearts((list) => list.filter((heart) => heart.id !== id)), 900)
  }, [])

  const caught = useCallback(() => {
    play('pop')
    setJig(true)
    setTimeout(() => setJig(false), 650)
    addHeart()
    catches.current += 1
    clearTimeout(rewardTimer.current)
    rewardTimer.current = setTimeout(() => {
      const count = catches.current
      if (!count) return
      catches.current = 0
      save((d) => ({
        ...d,
        joy: { v: clamp(d.joy.v + 6 * count), t: d.joy.t },
        energy: { v: clamp(d.energy.v - 2 * count), t: d.energy.t },
      }))
    }, 1200)
  }, [addHeart, save])

  const batted = useCallback(() => {
    play('bounce')
    setJig(true)
    setTimeout(() => setJig(false), 650)
  }, [])

  const checkPoop = useCallback(() => {
    const data = petRef.current
    if (!data || data.asleep) return
    const now = currentTime()
    if (!data.nextPoop) return save((d) => ({ ...d, nextPoop: now + randomGap() }))
    if (now < data.nextPoop) return
    const wasFull = data.poops >= MAX_POOPS
    save((d) => ({ ...d, poops: Math.min(MAX_POOPS, d.poops + 1), nextPoop: Date.now() + randomGap() }))
    if (!wasFull) {
      play('meow')
      say(`${name} needs the toilet 🚽`)
    }
  }, [name, save, say])

  useEffect(() => {
    api.current = { engage: setEngaged, caught, batted, checkPoop }
  }, [batted, caught, checkPoop])

  useEffect(() => {
    api.current = { engage: setEngaged, caught, batted, checkPoop }
  }, [batted, caught, checkPoop])

  if (!pet) {
    return <p className="text-center text-sm text-[#63636e]">{msg || 'Waking up the cat…'}</p>
  }

  const levels = Object.fromEntries(STATS.map(([key]) => [key, level(pet, key)]))
  const average = (levels.food + levels.clean + levels.energy + levels.joy) / 4
  const mood = average > 60 ? 'happy' : average > 35 ? 'ok' : 'sad'
  const ateToday = pet.ate.date === today ? pet.ate.n : 0
  const foodLeft = Math.max(0, Math.min(2, mealsToday - ateToday))
  const pose = pet.asleep
    ? 'sleep'
    : potty === 'go'
      ? 'potty'
      : chew
        ? 'eat'
        : room === 'play' && engaged
          ? 'play'
          : mood === 'sad'
            ? 'sad'
            : 'idle'
  const grime = levels.clean < 35 ? 2 : levels.clean < 70 ? 1 : 0 // 0 clean, 1 dirty, 2 super dirty
  const away = pet.asleep && room !== 'bed' // a sleeping cat stays in his bed
  const loo = potty === 'go' ? 'open' : potty === 'done' ? 'poop' : potty === 'flush' ? 'flush' : 'shut'

  let status = `${name} is happy 💕`
  if (pet.asleep) status = `${name} is sleeping 💤 · ⚡ ${Math.round(levels.energy)}%`
  else if (pet.poops > 0) status = `${name} needs the toilet 🚽 Take him to the bathroom`
  else if (levels.food < 30) status = foodLeft ? `${name} is hungry. Feed him in the kitchen` : `${name} is hungry. Send a selfie to get food 🍖`
  else if (grime === 2) status = `${name} is super dirty and smelly! Shower time 🚿`
  else if (levels.energy < 25) status = `${name} is sleepy. Take him to the bedroom 🛏️`
  else if (levels.joy < 30) status = `${name} is bored. Pet him or play 🧶`
  else if (grime === 1) status = `${name} is getting dirty. Take him to the shower 🚿`

  let hint = ''
  if (away) hint = `${name} is sleeping in the bedroom 💤`
  else if (room === 'kitchen' && foodLeft === 0) hint = ateToday >= 2 ? 'Full and happy for today 🍽️' : 'Food appears after a selfie passes the face check.'
  else if (room === 'bed') hint = pet.asleep ? `Tap ${name} or the moon to wake him (needs ⚡ ${WAKE_MIN}%)` : 'Tap the bed or the lamp to sleep'
  else if (room === 'bath') {
    if (potty === 'go') hint = `${name} is on the toilet…`
    else if (potty === 'done') hint = 'Press the flush button on the tank 🚽'
    else if (shower === 'rinse') hint = 'Rinsing off…'
    else if (shower === 'on') hint = suds ? `Keep rubbing ${name}… ${suds}%` : `Rub ${name} to lather him up 🧼`
    else if (pet.poops > 0) hint = `${name} needs to go. Tap the toilet 🚽`
    else hint = grime ? `${name} is ${grime === 2 ? 'super ' : ''}dirty. Tap the shower 🚿` : 'Tap the shower to wash him'
  } else if (room === 'play') {
    hint = levels.energy < 15 ? `${name} is too tired to play` : 'Drag the ball or yarn, then let go to throw it'
  }

  const awake = () => {
    if (!pet.asleep) return true
    say('Shh… sleeping 💤')
    return false
  }

  function doPet() {
    if (!awake()) return
    const time = currentTime()
    if (time - lastPet.current < 1200) return
    lastPet.current = time
    play('purr')
    addHeart()
    save((d) => ({ ...d, joy: { v: clamp(d.joy.v + 8), t: d.joy.t } }))
  }

  function eat() {
    if (!awake()) return
    save((d) => ({
      ...d,
      food: { v: clamp(d.food.v + 50), t: d.food.t },
      nextPoop: Math.min(d.nextPoop || Infinity, Date.now() + (15 + Math.random() * 15) * 60000),
      ate: { date: today, n: (d.ate.date === today ? d.ate.n : 0) + 1 },
    }))
    addHeart()
    play('munch')
    setChew(true)
    setTimeout(() => setChew(false), 1400)
    say('Yum! 😋')
  }

  function toggleSleep() {
    const energy = level(petRef.current, 'energy')
    if (petRef.current.asleep) {
      if (energy < WAKE_MIN) return say(`${name} is too tired to wake up. Let him sleep 😴`)
      save((d) => ({ ...d, asleep: false, nextPoop: Date.now() + randomGap() }))
      play('wake')
      say(`${name} woke up 🥱`)
    } else {
      if (energy > SLEEP_MAX) return say(`${name} is not sleepy yet`)
      save((d) => ({ ...d, asleep: true }))
      play('sleep')
    }
  }

  function changeRoom(id) {
    if (id === room) return
    setRoom(id)
    if (potty === 'go' || potty === 'done') {
      clearTimeout(pottyTimer.current)
      setPotty(null)
    }
    if (shower === 'on') {
      setShower('off')
      sudsRef.current = 0
      setSuds(0)
    }
  }

  /* ----- toilet: walk over, sit down, do his business, then flush ----- */

  function goToilet() {
    if (!awake()) return
    if (shower !== 'off') return say(`${name} is in the shower 🚿`)
    if (potty === 'done') return say('Press the flush button on the tank 🚽')
    if (potty) return
    if (pet.poops === 0) return say(`${name} doesn't need to go`)
    setPotty('go')
    say(`${name} is on the toilet 🚽`)
    clearTimeout(pottyTimer.current)
    pottyTimer.current = setTimeout(() => {
      setPotty('done')
      play('success')
      say('All done! Press flush 🚽')
    }, 2800)
  }

  function flush() {
    if (potty !== 'done') return say(potty ? 'Not yet…' : 'Nothing to flush')
    setPotty('flush')
    play('flush')
    setTimeout(() => {
      setPotty(null)
      save((d) => ({ ...d, poops: 0, joy: { v: clamp(d.joy.v + 4), t: d.joy.t } }))
      say('Flushed 🚽')
    }, 1700)
  }

  /* ----- shower: water on, lather up by rubbing, rinse off ----- */

  function toggleShower() {
    if (!awake()) return
    if (potty) return say(`${name} is busy 🚽`)
    if (shower === 'rinse') return
    if (shower === 'on') {
      setShower('off')
      sudsRef.current = 0
      setSuds(0)
      say(`${name} stepped out`)
      return
    }
    play('water')
    setShower('on')
    say(`${name} is in the shower. Rub him to scrub 🧼`)
  }

  function addSuds(amount) {
    if (rinsing.current) return
    const before = Math.floor(sudsRef.current / 15)
    sudsRef.current = Math.min(100, sudsRef.current + amount)
    if (Math.floor(sudsRef.current / 15) !== before) play('bubble')
    const value = Math.round(sudsRef.current)
    if (value !== suds) setSuds(value)
    if (sudsRef.current >= 100) rinse()
  }

  function rinse() {
    rinsing.current = true
    setShower('rinse')
    play('water')
    say('Rinsing off… 🫧')
    setTimeout(() => {
      sudsRef.current = 0
      rinsing.current = false
      setSuds(0)
      setShower('off')
      save((d) => ({ ...d, clean: { v: 100, t: d.clean.t } }))
      setJig(true)
      setTimeout(() => setJig(false), 650)
      say('Squeaky clean ✨')
      play('success')
    }, 2000)
  }

  /* ----- playroom: drag + throw ----- */

  function toScene(event) {
    const box = stageRef.current.getBoundingClientRect()
    return {
      x: ((event.clientX - box.left) * SW) / box.width,
      y: ((event.clientY - box.top) * SH) / box.height,
    }
  }

  function grab(key, event) {
    if (!stageRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const toy = toysRef.current[key]
    toy.held = true
    toy.vx = 0
    toy.vh = 0
    drag.current = { samples: [] }
    brainRef.current.alert = 0
    dragToy(key, event)
  }

  function dragToy(key, event) {
    const toy = toysRef.current[key]
    if (!toy.held) return
    const { x, y } = toScene(event)
    toy.x = clamp(x, TOY[key].r, SW - TOY[key].r)
    toy.h = clamp(FLOOR - TOY[key].r - y, 0, 230)
    const samples = drag.current.samples
    samples.push({ x, y, t: monotonicTime() })
    if (samples.length > 6) samples.shift()
  }

  function drop(key) {
    const toy = toysRef.current[key]
    if (!toy.held) return
    toy.held = false
    const samples = drag.current.samples
    const first = samples[0]
    const lastSample = samples[samples.length - 1]
    if (first && lastSample && lastSample.t - first.t > 10 && monotonicTime() - lastSample.t < 120) {
      const span = (lastSample.t - first.t) / 1000
      toy.vx = capSpeed((lastSample.x - first.x) / span)
      toy.vh = capSpeed(-(lastSample.y - first.y) / span)
    }
    drag.current = { samples: [] }
    const brain = brainRef.current
    brain.chain = 0
    brain.alert = 4
    if (levels.energy < 15) say(`${name} is too tired to play`)
  }

  function grabYarn(event) {
    grab('yarn', event)
  }

  function dragYarn(event) {
    dragToy('yarn', event)
  }

  function dropYarn() {
    drop('yarn')
  }

  function grabBall(event) {
    grab('ball', event)
  }

  function dragBall(event) {
    dragToy('ball', event)
  }

  function dropBall() {
    drop('ball')
  }

  /* ----- touching the cat ----- */

  const down = (event) => {
    rub.current = { on: true, x: event.clientX, y: event.clientY, dist: 0 }
  }
  const move = (event) => {
    const r = rub.current
    if (!r.on) return
    const step = Math.hypot(event.clientX - r.x, event.clientY - r.y)
    r.dist += step
    r.x = event.clientX
    r.y = event.clientY
    if (pet.asleep) return
    if (room === 'bath' && shower === 'on') {
      addSuds(step / 6)
    } else if (r.dist >= 140) {
      r.dist = 0
      doPet()
    }
  }
  const up = () => {
    rub.current.on = false
  }
  const tap = () => {
    if (rub.current.dist < 8 && pet.asleep && room === 'bed') toggleSleep()
  }

  let catClass = 'pt-catbox'
  if (room === 'bed') catClass += pet.asleep ? ' onbed' : ' awake-bed'
  else if (room === 'bath') {
    if (potty === 'go') catClass += ' on-toilet'
    else if (shower !== 'off') catClass += ' in-shower pt-wet'
    else catClass += ' in-bath'
  } else if (room === 'play') catClass += ' playing'

  const needsToilet = pet.poops > 0 && !potty && !pet.asleep

  return (
    <section className="glass rounded-3xl p-3">
      <style>{STYLES + ART_STYLES}</style>

      <div className="pt-stats">
        {STATS.map(([key, label]) => {
          const bad = key === 'toilet' ? levels[key] >= 80 : levels[key] < 30
          const image = statImage(key)
          return (
            <div key={key} title={label}>
              <p className={`pt-ico ${bad ? 'alert' : ''}`}>
                {image ? <img src={image} alt={label} /> : <StatIcon name={key} />}
              </p>
              <div className={`pt-bar ${bad ? 'low' : ''}`}><span style={{ width: `${levels[key]}%` }} /></div>
            </div>
          )
        })}
      </div>

      <div className="pt-stage" ref={stageRef}>
        <Scene key={room} room={room} water={shower !== 'off'} loo={loo} />
        <span className="pt-pill">🐱 {name}</span>
        {hint && <p className="pt-hint">{hint}</p>}

        <div key={`props-${room}`} className="pt-props">
          {room === 'kitchen' && (
            <>
              <span className="pt-prop" style={{ left: 14, bottom: 18, pointerEvents: 'none' }}>🥣</span>
              {Array.from({ length: foodLeft }, (_, index) => (
                <button key={index} type="button" className="pt-prop" style={{ left: 8 + index * 38, bottom: 62 }} onClick={eat} aria-label="Feed the cat">
                  🍖
                </button>
              ))}
            </>
          )}
          {room === 'bed' && (
            <>
              {!pet.asleep && (
                <button type="button" className="pt-prop" style={{ left: '3%', top: '32%', width: '44%', height: '30%' }} onClick={toggleSleep} aria-label="Go to sleep" />
              )}
              <button type="button" className="pt-prop" style={{ right: 12, top: 6 }} onClick={toggleSleep} aria-label={pet.asleep ? 'Wake up' : 'Go to sleep'}>
                {pet.asleep ? '🌙' : '💡'}
              </button>
            </>
          )}
          {room === 'bath' && (
            <>
              <button
                type="button"
                className="pt-hit"
                style={{ left: '20%', top: '38.7%', width: '35.6%', height: '60%', borderRadius: 14 }}
                onClick={toggleShower}
                aria-label={shower === 'off' ? 'Take Heli to the shower' : 'Turn the shower off'}
              />
              <button
                type="button"
                className={`pt-hit ${shower === 'off' && grime > 0 && !potty ? 'hot' : ''}`}
                style={{ left: '42.2%', top: '33.3%' }}
                onClick={toggleShower}
                aria-label={shower === 'on' ? 'Turn the shower off' : 'Turn the shower on'}
              />
              <button
                type="button"
                className="pt-hit"
                style={{ left: '85%', top: '56%', width: '26%', height: '22%', borderRadius: 18 }}
                onClick={goToilet}
                aria-label="Use the toilet"
              />
              <button
                type="button"
                className={`pt-hit ${potty === 'done' ? 'hot' : ''}`}
                style={{ left: '85%', top: '22.5%' }}
                onClick={flush}
                aria-label="Flush the toilet"
              />
            </>
          )}
        </div>

        {room === 'bath' && shower !== 'off' &&
          DROPS.map((left, index) => (
            <span key={left} className="pt-drop" style={{ left: `${left}%`, animationDelay: `${index * 0.09}s` }} />
          ))}
        {room === 'bath' && shower === 'on' && suds > 0 && (
          <div className="pt-bar absolute left-4 right-4" style={{ bottom: 6, zIndex: 3 }}><span style={{ width: `${suds}%` }} /></div>
        )}

        {!away && (
          <div
            className={catClass}
            data-pet-cat=""
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
            onClick={tap}
          >
            <div className={`pt-lift ${jig ? 'pt-jig' : ''}`}>
              <Cat key={pose === 'sleep' ? 'sleep' : 'sit'} pose={pose} dirty={grime} />
            </div>
            {room === 'bath' && suds > 0 && (
              <svg className="pt-foam" viewBox="0 0 200 200" style={{ opacity: shower === 'rinse' ? 0 : 1 }} aria-hidden="true">
                {FOAM.slice(0, Math.ceil((suds / 100) * FOAM.length)).map(([cx, cy, r], index) => (
                  <circle key={index} cx={cx} cy={cy} r={r} fill="#fff" stroke="#cfe9f0" strokeWidth="1.5" />
                ))}
              </svg>
            )}
            {needsToilet && (
              <span className="pt-need" aria-label="Needs the toilet">🚽{pet.poops > 1 ? ` ×${pet.poops}` : ''}</span>
            )}
            {pet.asleep && (
              <>
                <span className="pt-z absolute text-xl" style={{ right: '8%', top: '30%', color: '#fff' }}>z</span>
                <span className="pt-z absolute text-sm" style={{ right: '0%', top: '22%', color: '#fff', animationDelay: '1.2s' }}>z</span>
              </>
            )}
            {hearts.map((heart) => (
              <span key={heart.id} className="pt-heart" style={{ left: `${heart.x}%` }}>❤️</span>
            ))}
          </div>
        )}

        {room === 'play' && (
          <svg className="pt-toys" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none">
            <ellipse data-toy="ballShadow" cx={INITIAL_TOYS.ball.x} cy={FLOOR + 2} rx="11" ry="3" fill="rgba(0,0,0,.2)" />
            <ellipse data-toy="yarnShadow" cx={INITIAL_TOYS.yarn.x} cy={FLOOR + 2} rx="12" ry="3" fill="rgba(0,0,0,.2)" />

            <polyline data-toy="threadA" points={threadPoints(INITIAL_TOYS.yarn)} fill="none" stroke="#5a3418" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline data-toy="threadB" points={threadPoints(INITIAL_TOYS.yarn)} fill="none" stroke="#5aa9e6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

            <g
              data-toy="yarnG"
              transform={toyTransform('yarn', INITIAL_TOYS.yarn)}
              onPointerDown={grabYarn}
              onPointerMove={dragYarn}
              onPointerUp={dropYarn}
              onPointerCancel={dropYarn}
              style={{ pointerEvents: 'auto', cursor: 'grab' }}
              aria-label="Yarn"
            >
              <circle r="30" fill="transparent" />
              <g data-toy="yarnSpin">
                <circle r="13" fill="#5aa9e6" stroke="#5a3418" strokeWidth="3" />
                <path d="M-12 -3Q0 5 12 -3M-9 6Q0 -2 9 6M-3 -12Q6 0 -3 12" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
              </g>
            </g>

            <g
              data-toy="ballG"
              transform={toyTransform('ball', INITIAL_TOYS.ball)}
              onPointerDown={grabBall}
              onPointerMove={dragBall}
              onPointerUp={dropBall}
              onPointerCancel={dropBall}
              style={{ pointerEvents: 'auto', cursor: 'grab' }}
              aria-label="Ball"
            >
              <circle r="30" fill="transparent" />
              <g data-toy="ballSpin">
                <circle r="12" fill="#f07a8a" stroke="#5a3418" strokeWidth="3" />
                <path d="M0 -12Q8 0 0 12M-12 0Q0 7 12 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </g>
              <circle cx="-4" cy="-5" r="2.8" fill="#fff" opacity=".55" />
            </g>
          </svg>
        )}

        {room === 'bed' && pet.asleep && <div className="pt-dark" />}
      </div>

      <p className="text-center text-sm text-[#9a9aa6] mt-3 min-h-5">{msg || status}</p>

      <div className="pt-tabs">
        {Object.entries(ROOMS).map(([id, item]) => (
          <button key={id} type="button" className={`pt-tab ${room === id ? 'on' : ''}`} onClick={() => changeRoom(id)}>
            <RoomIcon name={id} size={28} />
            {item.label}{id === 'bed' && pet.asleep ? ' 💤' : ''}
          </button>
        ))}
      </div>
    </section>
  )
}