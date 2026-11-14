import { useEffect, useRef, useState } from 'react'

export default function Splash({ onDone }) {
  const canvasRef = useRef(null)
  const [leaving, setLeaving] = useState(false)

  // keep the latest onDone in a ref so a parent re-render never restarts the exit timer
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setLeaving(true), reduce ? 2500 : 8500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => doneRef.current?.(), 700)
    return () => clearTimeout(timer)
  }, [leaving])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let clock = 0
    let lastNow = 0
    let width = 0
    let height = 0
    let animationFrame = 0
    const random = (min, max) => Math.random() * (max - min) + min
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
    const lerp = (from, to, amount) => from + (to - from) * amount
    const colorMix = (from, to, amount) =>
      `rgb(${Math.round(lerp(from[0], to[0], amount))},${Math.round(lerp(from[1], to[1], amount))},${Math.round(lerp(from[2], to[2], amount))})`
    const easeInOut = (progress) =>
      progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2

    function makeGlowSprite(rgb) {
      const sprite = document.createElement('canvas')
      sprite.width = sprite.height = 64
      const spriteContext = sprite.getContext('2d')
      if (!spriteContext) return sprite
      const gradient = spriteContext.createRadialGradient(32, 32, 0, 32, 32, 32)
      gradient.addColorStop(0, `rgba(${rgb},1)`)
      gradient.addColorStop(0.15, `rgba(${rgb},.5)`)
      gradient.addColorStop(0.5, `rgba(${rgb},.1)`)
      gradient.addColorStop(1, `rgba(${rgb},0)`)
      spriteContext.fillStyle = gradient
      spriteContext.fillRect(0, 0, 64, 64)
      return sprite
    }

    const warmGlow = makeGlowSprite('255,200,130')
    const brightGlow = makeGlowSprite('255,225,150')
    const stars = Array.from({ length: 140 }, () => ({
      x: random(0, 1),
      y: random(0, 0.7),
      radius: random(0.3, 1),
      alpha: random(0.3, 0.9),
      frequency: random(0.6, 2.4),
      phase: random(0, 6.28),
    }))
    const grass = Array.from({ length: 110 }, () => ({
      x: random(-0.02, 1.02),
      height: random(0.015, 0.055),
      phase: random(0, 6.28),
    }))
    const seeds = Array.from({ length: 70 }, (_, index) => ({
      radius: Math.sqrt((index + 0.5) / 70),
      angle: index * 2.39996,
    }))
    const hillY = (position) =>
      (1 - position) ** 2 * 0.88 +
      2 * position * (1 - position) * 0.82 +
      position ** 2 * 0.9

    function resizeCanvas() {
      const pixelRatio = Math.min(devicePixelRatio || 1, 1.5)
      width = innerWidth
      height = innerHeight
      canvas.width = width * pixelRatio
      canvas.height = height * pixelRatio
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    function drawEllipse(x, y, radiusX, radiusY, rotation, fill) {
      context.save()
      context.translate(x, y)
      context.rotate(rotation)
      context.fillStyle = fill
      context.beginPath()
      context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    function drawFrame(now) {
      // advance the clock by a capped step so a hidden tab or a hitch never skips the intro
      const step = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0
      lastNow = now
      if (document.hidden) {
        animationFrame = requestAnimationFrame(drawFrame)
        return
      }
      clock += step
      const time = reduceMotion ? 12 : clock
      const progress = easeInOut(clamp(time / 6, 0, 1))
      const daylight = clamp(progress * 1.25, 0, 1)
      const sunX = width * (0.16 + 0.68 * progress)
      const sunY = height * (0.74 - 0.46 * Math.sin((progress * Math.PI) / 2))
      context.clearRect(0, 0, width, height)

      const sky = context.createLinearGradient(0, 0, 0, height * 0.9)
      sky.addColorStop(0, colorMix([5, 6, 12], [34, 40, 96], daylight))
      sky.addColorStop(1, colorMix([18, 16, 38], [255, 160, 100], daylight))
      context.globalAlpha = 0.5 - 0.1 * daylight
      context.fillStyle = sky
      context.fillRect(0, 0, width, height)

      for (const star of stars) {
        context.globalAlpha =
          star.alpha *
          (0.65 + 0.35 * Math.sin(time * star.frequency + star.phase)) *
          (1 - daylight)
        context.fillStyle = '#f0f4ff'
        context.beginPath()
        context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2)
        context.fill()
      }

      context.globalAlpha = 0.25 + 0.5 * daylight
      const glowSize = width * 0.75
      context.drawImage(
        warmGlow,
        sunX - glowSize,
        sunY - glowSize,
        glowSize * 2,
        glowSize * 2,
      )
      context.globalAlpha = clamp(daylight * 2, 0, 1)
      const sunSize = width * 0.14
      context.drawImage(
        brightGlow,
        sunX - sunSize,
        sunY - sunSize,
        sunSize * 2,
        sunSize * 2,
      )
      context.fillStyle = '#fff3cf'
      context.beginPath()
      context.arc(sunX, sunY, width * 0.05, 0, Math.PI * 2)
      context.fill()

      context.globalAlpha = 0.93
      context.fillStyle = '#04050a'
      context.beginPath()
      context.moveTo(0, height * 0.88)
      context.quadraticCurveTo(width * 0.5, height * 0.76, width, height * 0.9)
      context.lineTo(width, height)
      context.lineTo(0, height)
      context.closePath()
      context.fill()

      context.globalAlpha = 1
      context.strokeStyle = '#05070c'
      context.lineWidth = 1.4
      context.beginPath()
      for (const blade of grass) {
        const baseX = blade.x * width
        const baseY = height * hillY(clamp(blade.x, 0, 1)) + 6
        const sway = Math.sin(time * 1.2 + blade.phase) * 3
        context.moveTo(baseX, baseY)
        context.lineTo(baseX + sway, baseY - blade.height * height)
      }
      context.stroke()

      const baseX = width * 0.42
      const baseY = height * hillY(0.42) + 6
      const flowerHeight = Math.min(height * 0.34, width * 0.85)
      const growth = easeInOut(clamp((time - 0.3) / 2, 0, 1))
      const bloom = clamp((time - 1.6) / 1.6, 0, 1)
      const grownHeight = flowerHeight * growth
      const lean = clamp((sunX - baseX) / (width * 0.5), -1, 1)
      const flowerX = baseX + lean * grownHeight * 0.38
      const flowerY = baseY - grownHeight * 0.98
      const controlX = baseX - lean * grownHeight * 0.05
      const controlY = baseY - grownHeight * 0.62
      const stemWidth = Math.max(3, width * 0.012)

      context.strokeStyle = '#14301f'
      context.lineWidth = stemWidth
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(baseX, baseY)
      context.quadraticCurveTo(controlX, controlY, flowerX, flowerY)
      context.stroke()

      context.strokeStyle = `rgba(255,190,110,${(daylight * 0.45).toFixed(3)})`
      context.lineWidth = stemWidth * 0.3
      context.beginPath()
      context.moveTo(baseX + stemWidth * 0.25, baseY)
      context.quadraticCurveTo(
        controlX + stemWidth * 0.25,
        controlY,
        flowerX + stemWidth * 0.25,
        flowerY,
      )
      context.stroke()

      for (const [position, side] of [[0.32, -1], [0.52, 1]]) {
        const inverse = 1 - position
        const leafX =
          inverse ** 2 * baseX + 2 * inverse * position * controlX + position ** 2 * flowerX
        const leafY =
          inverse ** 2 * baseY + 2 * inverse * position * controlY + position ** 2 * flowerY
        const leafSize = grownHeight * (0.15 + 0.02 * position)
        if (growth > 0.2) {
          drawEllipse(leafX + side * leafSize * 0.9, leafY - leafSize * 0.15, leafSize, leafSize * 0.36, side * -0.5, '#173a26')
        }
      }

      const headRadius =
        Math.min(width * 0.085, 46) * (0.25 + 0.75 * bloom) * (growth > 0.5 ? 1 : growth * 2)

      if (growth > 0.05) {
        const sunVectorX = sunX - flowerX
        const sunVectorY = sunY - flowerY
        const vectorLength = Math.hypot(sunVectorX, sunVectorY) || 1
        const sunAngle = Math.atan2(sunVectorY, sunVectorX)

        for (let petal = 0; petal < 16; petal += 1) {
          const angle = (petal / 16) * Math.PI * 2 + 0.2
          const light = Math.max(0, Math.cos(angle - sunAngle)) * daylight
          drawEllipse(
            flowerX + Math.cos(angle) * headRadius * 0.8,
            flowerY + Math.sin(angle) * headRadius * 0.8,
            headRadius * 0.5,
            headRadius * 0.17,
            angle,
            colorMix([90, 56, 12], [214, 150, 40], light * 0.8),
          )
        }

        for (let petal = 0; petal < 16; petal += 1) {
          const angle = (petal / 16) * Math.PI * 2
          const light = Math.max(0, Math.cos(angle - sunAngle)) * daylight
          drawEllipse(
            flowerX + Math.cos(angle) * headRadius * 0.98,
            flowerY + Math.sin(angle) * headRadius * 0.98,
            headRadius * 0.55,
            headRadius * 0.2,
            angle,
            colorMix([120, 78, 16], [255, 205, 80], light * 0.9 + 0.05),
          )
        }

        const faceX = flowerX + (sunVectorX / vectorLength) * headRadius * 0.15
        const faceY = flowerY + (sunVectorY / vectorLength) * headRadius * 0.15
        context.fillStyle = '#2b1709'
        context.beginPath()
        context.arc(faceX, faceY, headRadius * 0.55, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = 'rgba(120,80,30,.8)'
        for (const seed of seeds) {
          context.beginPath()
          context.arc(
            faceX + Math.cos(seed.angle) * seed.radius * headRadius * 0.5,
            faceY + Math.sin(seed.angle) * seed.radius * headRadius * 0.5,
            Math.max(0.5, headRadius * 0.025),
            0,
            Math.PI * 2,
          )
          context.fill()
        }

        context.strokeStyle = `rgba(255,200,120,${(daylight * 0.7).toFixed(3)})`
        context.lineWidth = 1.2
        context.beginPath()
        context.arc(faceX, faceY, headRadius * 0.55, sunAngle - 1, sunAngle + 1)
        context.stroke()

        if (time > 4) {
          const particlesIn = clamp((time - 4) / 1.5, 0, 1)
          const groundY = height * 0.86
          for (let particle = 0; particle < 14; particle += 1) {
            const particleProgress = ((time - 4) * 0.11 + particle / 14) % 1
            const particleX =
              flowerX +
              Math.cos(particle * 2.1) * headRadius * 0.7 +
              Math.sin(particle * 3 + time * 1.1) * headRadius * 1.1 * particleProgress
            const particleY = flowerY + particleProgress * (groundY - flowerY)
            context.globalAlpha = particlesIn * (1 - particleProgress ** 3)
            drawEllipse(
              particleX,
              particleY,
              headRadius * 0.34,
              headRadius * 0.13,
              time * 1.4 + particle,
              colorMix([214, 150, 40], [255, 205, 80], daylight),
            )
          }

          context.globalAlpha = 1
          for (let particle = 0; particle < 18; particle += 1) {
            const particleProgress = (time * 0.12 + particle / 18) % 1
            context.globalAlpha = (1 - particleProgress) * 0.8 * particlesIn
            context.drawImage(
              brightGlow,
              flowerX + Math.sin(particle * 7 + time * 0.5) * headRadius * 2.4 * particleProgress - 4,
              flowerY - particleProgress * height * 0.28 - 4,
              8,
              8,
            )
          }
          context.globalAlpha = 1
        }
      }

      const flareAlpha = Math.max(0, 1 - Math.abs(time - 2.8) / 0.7) * 0.16
      if (flareAlpha > 0) {
        context.fillStyle = `rgba(255,210,150,${flareAlpha.toFixed(3)})`
        context.fillRect(0, 0, width, height)
      }

      animationFrame = requestAnimationFrame(drawFrame)
    }

    resizeCanvas()
    addEventListener('resize', resizeCanvas)
    animationFrame = requestAnimationFrame(drawFrame)

    return () => {
      cancelAnimationFrame(animationFrame)
      removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <div
      className={`sp ${leaving ? 'sp-out' : ''}`}
      onClick={() => setLeaving(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') setLeaving(true)
      }}
      aria-label="Continue to Heliotrope"
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="sp-tx">
        <h1 className="sp-t">Heliotrope</h1>
        <p className="sp-g">the wrong answer that led me to you</p>
      </div>
      <p className="sp-p">tap to continue</p>
    </div>
  )
}