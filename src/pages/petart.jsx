import { memo } from 'react'

// Flat, hand-drawn look: orange, cream, dark brown outline, pink.
const OR = '#f2a04a'
const CR = '#fbe6c2'
const BR = '#5a3418'
const PK = '#f4a3a8'
const EYE = '#2b1709'
const line = { stroke: BR, strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' }

export const ART_STYLES = `
@keyframes pt-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pt-breath { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.012, 1.03); } }
@keyframes pt-wag { from { transform: rotate(-4deg); } to { transform: rotate(7deg); } }
@keyframes pt-tilt { 0%, 100% { transform: rotate(0); } 35% { transform: rotate(2deg); } 70% { transform: rotate(-2deg); } }
@keyframes pt-chomp { from { transform: translateY(0) rotate(-1.5deg); } to { transform: translateY(4px) rotate(1.5deg); } }
@keyframes pt-munch { from { transform: scaleY(.4); } to { transform: scaleY(1); } }
@keyframes pt-twitch { 0%, 90%, 100% { transform: rotate(0); } 93% { transform: rotate(7deg); } 96% { transform: rotate(-2deg); } }
@keyframes pt-blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
.pt-scene { position: absolute; inset: 0; width: 100%; height: 100%; animation: pt-fade .4s ease both; }
.pt-svg { width: 100%; height: 100%; overflow: visible; animation: pt-fade .35s ease both; }
.pt-breath, .pt-tailg, .pt-head, .pt-chomp, .pt-mouth, .pt-ear, .pt-eye { transform-box: fill-box; }
.pt-breath { transform-origin: 50% 100%; animation: pt-breath 4.5s ease-in-out infinite; will-change: transform; }
.pt-tailg { transform-origin: 0% 100%; animation: pt-wag 3.2s ease-in-out infinite alternate; }
.pt-head { transform-origin: 50% 100%; animation: pt-tilt 7s ease-in-out infinite; }
.pt-chomp { transform-origin: 50% 100%; animation: pt-chomp .34s ease-in-out infinite alternate; }
.pt-mouth { transform-origin: 50% 0%; animation: pt-munch .34s ease-in-out infinite alternate; }
.pt-ear { transform-origin: 50% 100%; transition: transform .5s cubic-bezier(.22, 1, .36, 1); }
.pt-ear.r { animation: pt-twitch 9s ease-in-out infinite; }
.pt-ear.sad.l { transform: rotate(-16deg); }
.pt-ear.sad.r { transform: rotate(16deg); animation: none; }
.pt-eye { transform-origin: 50% 50%; animation: pt-blink 5s ease-in-out infinite; }
.pt-eye.r { animation-delay: .05s; }
@keyframes pt-spin { to { transform: rotate(360deg); } }
@keyframes pt-sink { 0% { transform: scale(1) rotate(0); opacity: 1; } 100% { transform: scale(0) rotate(540deg); opacity: 0; } }
.pt-fly { transform-origin: 100px 40px; animation: pt-spin 2.4s linear infinite; }
.pt-swirl { transform-box: fill-box; transform-origin: 50% 50%; animation: pt-spin .55s linear infinite; }
.pt-sink { transform-box: fill-box; transform-origin: 50% 50%; animation: pt-sink 1.5s ease-in forwards; }
@media (prefers-reduced-motion: reduce) {
  .pt-swirl, .pt-sink, .pt-fly { animation: none !important; }
  .pt-scene, .pt-svg, .pt-breath, .pt-tailg, .pt-head, .pt-chomp, .pt-mouth, .pt-ear, .pt-eye { animation: none !important; }
}
`

const SCENES = {
  kitchen: {
    wall: '#f7e4b9', floor: '#d9a36a', base: '#b9824b',
    deco: (
      <>
        <rect x="36" y="40" width="96" height="84" rx="8" fill="#bfe3f6" stroke="#fff" strokeWidth="6" />
        <path d="M84 40v84M36 82h96" stroke="#fff" strokeWidth="4" />
        <rect x="160" y="52" width="58" height="42" rx="4" fill="#f3a98a" stroke="#fff" strokeWidth="4" />
        <circle cx="189" cy="73" r="10" fill="#fff" opacity=".7" />
        <rect x="262" y="46" width="74" height="156" rx="10" fill="#f4f6f8" />
        <rect x="262" y="108" width="74" height="4" fill="#cfd6dc" />
        <rect x="274" y="68" width="5" height="28" rx="2" fill="#9aa5ad" />
        <rect x="274" y="124" width="5" height="36" rx="2" fill="#9aa5ad" />
      </>
    ),
  },
  bed: {
    wall: '#d7d9f7', floor: '#a893c9', base: '#8a75b0',
    deco: (
      <>
        <rect x="236" y="62" width="84" height="84" rx="42" fill="#2a3566" stroke="#fff" strokeWidth="6" />
        <circle cx="280" cy="104" r="18" fill="#ffe9a8" />
        <circle cx="254" cy="86" r="2.5" fill="#fff" />
        <circle cx="300" cy="128" r="2" fill="#fff" />
        <rect x="190" y="52" width="36" height="46" rx="4" fill="#fff" stroke="#8a75b0" strokeWidth="4" />
        <path d="M196 90l9-14 7 8 5-5 5 11z" fill="#9ad1c0" />
        {/* the bed */}
        <rect x="22" y="204" width="10" height="14" rx="3" fill="#6b57b5" />
        <rect x="174" y="204" width="10" height="14" rx="3" fill="#6b57b5" />
        <rect x="8" y="92" width="16" height="118" rx="7" fill="#6b57b5" />
        <rect x="18" y="150" width="176" height="56" rx="12" fill="#fff" />
        <rect x="108" y="150" width="86" height="56" rx="12" fill="#8f7bd6" />
        <path d="M108 162h86M108 176h86" stroke="#7a66c4" strokeWidth="2" />
        <rect x="26" y="136" width="58" height="26" rx="13" fill="#f4efff" />
      </>
    ),
  },
  bath: { wall: '#c6ebef', floor: '#8fc7ce', base: '#74aab1', deco: null },
  play: {
    wall: '#f9d7e0', floor: '#e9b6c7', base: '#cf94aa',
    deco: (
      <>
        {[[30, 30], [90, 60], [150, 24], [210, 70], [270, 28], [330, 62], [60, 120], [200, 130], [310, 120]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="#fff" opacity=".55" />
        ))}
        <rect x="30" y="100" width="120" height="8" rx="4" fill="#c98a4b" />
        <rect x="42" y="76" width="24" height="24" rx="4" fill="#f4b942" />
        <rect x="72" y="84" width="20" height="16" rx="4" fill="#6fc1e4" />
        <circle cx="122" cy="88" r="12" fill="#f07a8a" />
        <ellipse cx="280" cy="30" rx="20" ry="24" fill="#f07a8a" />
        <ellipse cx="318" cy="46" rx="16" ry="20" fill="#6fc1e4" />
      </>
    ),
  },
}

const Poop = () => (
  <>
    <ellipse cx="307" cy="170" rx="10" ry="4.5" fill="#8b5a2b" />
    <ellipse cx="307" cy="166" rx="7" ry="3.5" fill="#9a6733" />
    <ellipse cx="307" cy="163" rx="3.5" ry="2.6" fill="#a97538" />
  </>
)

// water = shower running. loo = 'shut' | 'open' | 'poop' | 'flush'
function Bath({ water, loo }) {
  const open = loo !== 'shut'
  return (
    <>
      <path d="M0 50H360M0 100H360M0 150H360M60 0V200M120 0V200M180 0V200M240 0V200M300 0V200" stroke="#a8d4d9" strokeWidth="2" />
      <rect x="176" y="48" width="64" height="48" rx="6" fill="#e9f7f9" stroke="#fff" strokeWidth="5" />
      <path d="M208 48v48M176 72h64" stroke="#fff" strokeWidth="3" />

      {/* shower stall */}
      <rect x="8" y="26" width="128" height="180" rx="6" fill="#e9f7f9" fillOpacity=".4" stroke="#fff" strokeWidth="5" />
      <path d="M24 46L38 150M44 46L52 96" stroke="#fff" strokeOpacity=".55" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 26V50H58" fill="none" stroke="#aab6bd" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 50h40l-6 14H56z" fill="#c4cfd5" stroke="#8f9ea8" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M58 60h24" stroke="#8f9ea8" strokeWidth="2" strokeDasharray="1 4" strokeLinecap="round" />
      <ellipse cx="72" cy="276" rx="62" ry="11" fill="#6fb5be" />
      <ellipse cx="72" cy="276" rx="48" ry="7" fill="#7cc2ca" />

      {/* tap */}
      <g transform="translate(152 100)">
        <circle r="12" fill="#e4ebee" stroke="#aab6bd" strokeWidth="3" />
        <rect x="-3" y="-14" width="6" height="15" rx="3" fill={water ? '#4aa3df' : '#8895a0'} transform={`rotate(${water ? 70 : 0})`} />
        <circle r="3" fill="#8895a0" />
      </g>

      {/* toilet */}
      <rect x="290" y="206" width="34" height="10" rx="4" fill="#e8eff1" stroke="#c9d6da" strokeWidth="3" />
      <rect x="284" y="118" width="46" height="54" rx="6" fill="#e8eff1" stroke="#c9d6da" strokeWidth="3" />
      <rect x="282" y="72" width="50" height="50" rx="6" fill="#fff" stroke="#c9d6da" strokeWidth="3" />
      <rect x="276" y="62" width="62" height="10" rx="5" fill="#f4f7f8" stroke="#c9d6da" strokeWidth="3" />
      <circle cx="307" cy="67" r="4.5" fill={loo === 'poop' ? '#f0b83a' : '#b9c4cb'} stroke="#8f9ea8" strokeWidth="2" />
      <path d="M270 168C270 202 286 211 307 211C328 211 344 202 344 168Z" fill="#fff" stroke="#c9d6da" strokeWidth="3" strokeLinejoin="round" />
      {open ? (
        <>
          <ellipse cx="307" cy="168" rx="36" ry="12" fill="#fff" stroke="#c9d6da" strokeWidth="3" />
          <ellipse cx="307" cy="168" rx="27" ry="8" fill="#8cc9e0" />
          {loo === 'poop' && <Poop />}
          {loo === 'flush' && (
            <>
              <g className="pt-swirl">
                <path d="M288 168q19-10 38 0M295 172q12 5 24 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
              <g className="pt-sink"><Poop /></g>
            </>
          )}
        </>
      ) : (
        <ellipse cx="307" cy="167" rx="34" ry="11" fill="#f7fbfc" stroke="#c9d6da" strokeWidth="3" />
      )}
    </>
  )
}

export function Scene({ room, water = false, loo = 'shut' }) {
  const scene = SCENES[room]
  return (
    <svg className="pt-scene" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="360" height="300" fill={scene.wall} />
      {room === 'bath' ? <Bath water={water} loo={loo} /> : scene.deco}
      <rect y="200" width="360" height="100" fill={scene.floor} />
      <rect y="200" width="360" height="8" fill={scene.base} />
      <path d="M0 236H360M0 268H360" stroke={scene.base} strokeOpacity=".45" strokeWidth="2" />
      {room === 'play' && (
        <>
          <ellipse cx="180" cy="262" rx="130" ry="26" fill="#9ad1c0" />
          <ellipse cx="180" cy="262" rx="90" ry="16" fill="#b9e3d6" />
        </>
      )}
      {room === 'bed' && (
        <>
          <rect x="18" y="150" width="176" height="56" rx="12" fill="none" />
        </>
      )}
    </svg>
  )
}

function Flies() {
  return (
    <g className="pt-fly">
      <circle cx="152" cy="40" r="2.3" fill="#2b1709" />
      <circle cx="48" cy="34" r="2.3" fill="#2b1709" />
      <circle cx="100" cy="2" r="2.3" fill="#2b1709" />
    </g>
  )
}

// Drawn icons (no emoji fonts needed): glossy colored badge + white drawing.
const BADGES = {
  food: ['#ffc98f', '#ee8f3a'],
  clean: ['#b4e6f8', '#3f9bd8'],
  toilet: ['#b9ecd9', '#47b58f'],
  energy: ['#ffe58f', '#f2b231'],
  joy: ['#ffc4cb', '#e9566c'],
  kitchen: ['#ffc98f', '#ee8f3a'],
  bed: ['#d3c8f7', '#7f68c9'],
  bath: ['#a8ecf2', '#2fb0c6'],
  play: ['#ffc4cb', '#e9566c'],
}
const SOFT = 'rgba(70, 35, 15, .42)'

function Badge({ name, size, children }) {
  const [from, to] = BADGES[name]
  const id = `bd-${name}`
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx="16" cy="17" r="14.6" fill="rgba(0,0,0,.25)" />
      <circle cx="16" cy="16" r="14.6" fill={`url(#${id})`} />
      <circle cx="16" cy="16" r="13.9" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.2" />
      <path d="M6.2 12.2A11 11 0 0 1 25.8 12.2Q16 8.6 6.2 12.2z" fill="#fff" fillOpacity=".3" />
      <g style={{ filter: 'drop-shadow(0 1px 0 rgba(60,25,10,.35))' }}>{children}</g>
    </svg>
  )
}

const soft = { stroke: SOFT, strokeWidth: 1.1, strokeLinejoin: 'round', strokeLinecap: 'round' }

const GLYPHS = {
  food: (
    <>
      <path d="M14.4 17.6L9.4 22.6" stroke="#fff3dc" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="8.3" cy="21.5" r="1.9" fill="#fff3dc" />
      <circle cx="10.5" cy="23.7" r="1.9" fill="#fff3dc" />
      <ellipse cx="19" cy="13" rx="7.4" ry="5.8" transform="rotate(-40 19 13)" fill="#8a3f1f" stroke="#5a2410" strokeWidth="1.2" />
      <path d="M15.6 10.6q2.6-2.6 5.4-1.6" stroke="#ffb98a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </>
  ),
  clean: (
    <>
      <path d="M9 6.5V10.5H14" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.4 10.5h10.4l-2.3 4.4h-5.8z" fill="#fff" {...soft} />
      <path d="M15 18.2v3M18.2 18.2v4.6M21.4 18.2v3" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12.6" cy="24" r="1" fill="#fff" />
      <circle cx="23.4" cy="23.4" r="1.1" fill="#fff" />
    </>
  ),
  toilet: (
    <>
      <rect x="11" y="6.8" width="10" height="6.4" rx="1.8" fill="#fff" {...soft} />
      <path d="M8.2 14.2h15.6c0 4.8-3.1 7.7-7.8 7.7s-7.8-2.9-7.8-7.7z" fill="#fff" {...soft} />
      <rect x="12.8" y="21.6" width="6.4" height="2.6" rx="1" fill="#fff" {...soft} />
      <circle cx="16" cy="8.8" r="1" fill={BADGES.toilet[1]} />
    </>
  ),
  energy: <path d="M18.6 5.8L9.8 17.4h5.6L13.9 26.4l9-12.2h-5.8z" fill="#fff" {...soft} />,
  joy: <path d="M16 24.6s-8.2-5-8.2-10.8a4.4 4.4 0 0 1 8.2-2.3 4.4 4.4 0 0 1 8.2 2.3c0 5.8-8.2 10.8-8.2 10.8z" fill="#fff" {...soft} />,
  kitchen: (
    <>
      <circle cx="11.6" cy="12.4" r="2.1" fill="#fff3dc" />
      <circle cx="16" cy="10.6" r="2.1" fill="#fff3dc" />
      <circle cx="20.4" cy="12.4" r="2.1" fill="#fff3dc" />
      <path d="M7 14.6h18c0 6-3.6 9.8-9 9.8s-9-3.8-9-9.8z" fill="#fff" {...soft} />
    </>
  ),
  bed: (
    <>
      <rect x="6" y="10" width="3" height="14" rx="1.5" fill="#fff" {...soft} />
      <rect x="6" y="17" width="20" height="6.4" rx="2" fill="#fff" {...soft} />
      <rect x="10" y="13.2" width="7" height="4.2" rx="2.1" fill="#efe9ff" {...soft} />
      <rect x="24" y="23" width="2" height="2.6" rx="1" fill="#fff" />
    </>
  ),
  bath: (
    <>
      <circle cx="12" cy="10.4" r="2" fill="#fff" fillOpacity=".9" />
      <circle cx="16.4" cy="8.6" r="1.4" fill="#fff" fillOpacity=".9" />
      <circle cx="19.6" cy="11.4" r="2.2" fill="#fff" fillOpacity=".9" />
      <path d="M6 15.6h20v1.6c0 4.2-2.6 6.6-6.2 6.6h-7.6c-3.6 0-6.2-2.4-6.2-6.6z" fill="#fff" {...soft} />
    </>
  ),
  play: (
    <>
      <circle cx="16" cy="16" r="8.4" fill="#fff" {...soft} />
      <path d="M16 7.8Q22 16 16 24.2M7.8 16Q16 21.5 24.2 16" fill="none" stroke="#e9566c" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
}

export function StatIcon({ name, size = 28 }) {
  return <Badge name={name} size={size}>{GLYPHS[name]}</Badge>
}

export function RoomIcon({ name, size = 28 }) {
  return <Badge name={name} size={size}>{GLYPHS[name]}</Badge>
}

function Dirt({ level = 1 }) {
  return (
    <>
      {level > 1 && (
        <>
          <ellipse cx="100" cy="150" rx="34" ry="12" fill="#6b4423" opacity=".4" />
          <circle cx="58" cy="176" r="7" fill="#8b5a2b" opacity=".6" />
          <circle cx="146" cy="130" r="8" fill="#8b5a2b" opacity=".6" />
          <circle cx="96" cy="184" r="6" fill="#8b5a2b" opacity=".6" />
          <path d="M100 100 q-7 -9 0 -18 q7 -9 0 -18 M40 100 q-7 -9 0 -18 q7 -9 0 -18 M160 100 q7 -9 0 -18 q-7 -9 0 -18" stroke="#9bb85a" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".7" />
        </>
      )}
      <circle cx="62" cy="160" r="6" fill="#8b5a2b" opacity=".6" />
      <circle cx="140" cy="170" r="7" fill="#8b5a2b" opacity=".6" />
      <circle cx="108" cy="184" r="5" fill="#8b5a2b" opacity=".6" />
      <path d="M22 70 q-6 -8 0 -16 q6 -8 0 -16 M178 70 q6 -8 0 -16 q-6 -8 0 -16" stroke="#8b5a2b" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".6" />
    </>
  )
}

function Sitting({ pose, dirty }) {
  const sad = pose === 'sad'
  const eat = pose === 'eat'
  const potty = pose === 'potty'
  const play = pose === 'play'
  return (
    <svg viewBox="0 0 200 200" className="pt-svg" aria-hidden="true">
      <ellipse cx="100" cy="195" rx="62" ry="6" fill="rgba(0,0,0,.18)" />
      <g className="pt-tailg">
        <path d="M146 176 C190 178 196 128 170 118" fill="none" stroke={BR} strokeWidth="21" strokeLinecap="round" />
        <path d="M146 176 C190 178 196 128 170 118" fill="none" stroke={OR} strokeWidth="11" strokeLinecap="round" />
      </g>
      <g className="pt-breath">
        <path d="M60 110 C36 140 32 186 72 194 L130 194 C168 188 166 140 142 110 Z" fill={OR} {...line} />
        <ellipse cx="101" cy="162" rx="27" ry="26" fill={CR} />
        <path d="M52 150h12M50 164h12M148 150h-12M150 164h-12" stroke={BR} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="76" cy="193" rx="17" ry="8" fill={OR} {...line} strokeWidth="4" />
        <ellipse cx="126" cy="193" rx="17" ry="8" fill={OR} {...line} strokeWidth="4" />
        {eat && (
          <g>
            <ellipse cx="100" cy="150" rx="22" ry="11" fill="#9ccbe0" {...line} strokeWidth="3.5" />
            <path d="M120 150 l15 -9 v18 z" fill="#9ccbe0" {...line} strokeWidth="3.5" />
            <circle cx="89" cy="148" r="2.5" fill={EYE} />
          </g>
        )}
        <path d="M78 140 C70 154 74 170 88 170 C96 162 92 148 84 140 Z" fill={OR} {...line} strokeWidth="4" />
        <path d="M122 140 C130 154 126 170 112 170 C104 162 108 148 116 140 Z" fill={OR} {...line} strokeWidth="4" />
        {dirty > 0 && <Dirt level={dirty} />}

        <g className={eat ? 'pt-chomp' : 'pt-head'}>
          <g className={`pt-ear l ${sad ? 'sad' : ''}`}>
            <path d="M50 58 L46 16 L86 38 Z" fill={OR} {...line} />
            <path d="M54 48 L53 28 L70 38 Z" fill={PK} />
          </g>
          <g className={`pt-ear r ${sad ? 'sad' : ''}`}>
            <path d="M150 56 L158 14 L116 36 Z" fill={OR} {...line} />
            <path d="M148 46 L151 27 L132 37 Z" fill={PK} />
          </g>
          <path d="M44 80 C38 42 70 26 100 26 C134 26 160 44 156 82 C154 110 126 122 100 122 C70 122 48 110 44 80 Z" fill={OR} {...line} />
          <path d="M100 28 v12 M87 30 l3 11 M113 30 l-3 11" stroke={BR} strokeWidth="4" strokeLinecap="round" fill="none" />
          <ellipse cx="100" cy="98" rx="26" ry="17" fill={CR} />
          <circle cx="58" cy="94" r="8" fill={PK} opacity=".85" />
          <circle cx="143" cy="96" r="8" fill={PK} opacity=".85" />
          {eat || potty ? (
            <path d="M68 80 q8 -9 16 0 M116 82 q8 -9 16 0" stroke={EYE} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <ellipse className="pt-eye" cx="76" cy="80" rx={play ? 7 : 5.5} ry={play ? 8.5 : 6.5} fill={EYE} />
              <ellipse className="pt-eye r" cx="124" cy="82" rx={play ? 7 : 5.5} ry={play ? 8.5 : 6.5} fill={EYE} />
              {play && (
                <>
                  <circle cx="73" cy="76" r="2.4" fill="#fff" />
                  <circle cx="121" cy="78" r="2.4" fill="#fff" />
                </>
              )}
            </>
          )}
          {sad && (
            <>
              <path d="M64 70 L88 65 M136 72 L112 67" stroke={BR} strokeWidth="4" strokeLinecap="round" />
              <path d="M82 90 q-5 9 0 12 q5 -3 0 -12 z" fill="#bfe3f6" />
            </>
          )}
          {potty && <path d="M146 62q-6 9 0 13q6-4 0-13z" fill="#bfe3f6" />}
          {dirty > 1 && (
            <>
              <circle cx="84" cy="50" r="5" fill="#8b5a2b" opacity=".6" />
              <circle cx="132" cy="58" r="4" fill="#8b5a2b" opacity=".6" />
              <Flies />
            </>
          )}
          <path d="M94 90 h12 l-6 7 z" fill={PK} />
          {eat ? (
            <ellipse className="pt-mouth" cx="100" cy="106" rx="9" ry="7" fill="#7a3b22" />
          ) : potty ? (
            <path d="M92 106h16" stroke={BR} strokeWidth="3.5" strokeLinecap="round" />
          ) : play ? (
            <path d="M89 99q11 15 22 0z" fill="#7a3b22" stroke={BR} strokeWidth="3" strokeLinejoin="round" />
          ) : sad ? (
            <path d="M89 108 q11 -9 22 0" stroke={BR} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M89 100 q5.5 8 11 0 q5.5 8 11 0" stroke={BR} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          )}
          <path d="M52 100 l-22 -4 M52 107 l-22 6 M148 102 l22 -4 M148 109 l22 6" stroke={BR} strokeWidth="2.6" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

function Sleeping({ dirty }) {
  return (
    <svg viewBox="0 0 200 200" className="pt-svg" aria-hidden="true">
      <g className="pt-tailg">
        <path d="M168 168 C192 192 140 200 104 196" fill="none" stroke={BR} strokeWidth="19" strokeLinecap="round" />
        <path d="M168 168 C192 192 140 200 104 196" fill="none" stroke={OR} strokeWidth="9" strokeLinecap="round" />
      </g>
      <g className="pt-breath">
        <ellipse cx="104" cy="156" rx="76" ry="38" fill={OR} {...line} />
        <path d="M112 124v14M130 126l2 14M148 132l4 12" stroke={BR} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="112" cy="190" rx="18" ry="8" fill={CR} {...line} strokeWidth="4" />
        {dirty > 0 && <Dirt level={dirty} />}
        <path d="M36 134 L32 102 L62 120 Z" fill={OR} {...line} />
        <path d="M84 120 L98 102 L98 134 Z" fill={OR} {...line} />
        <ellipse cx="62" cy="152" rx="40" ry="34" fill={OR} {...line} />
        <ellipse cx="62" cy="164" rx="18" ry="11" fill={CR} />
        <circle cx="40" cy="164" r="6" fill={PK} opacity=".85" />
        <circle cx="86" cy="164" r="6" fill={PK} opacity=".85" />
        <path d="M44 150 q7 6 14 0 M68 150 q7 6 14 0" stroke={EYE} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M58 158 h10 l-5 6 z" fill={PK} />
        <path d="M57 169 q3 4 6 0 q3 4 6 0" stroke={BR} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export const Cat = memo(function Cat({ pose, dirty }) {
  return pose === 'sleep' ? <Sleeping dirty={dirty} /> : <Sitting pose={pose} dirty={dirty} />
})