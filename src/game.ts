import { audio, pentaFreq } from './engine/AudioEngine'
import { track } from './analytics'
import { stats } from './share'
import { t as tr } from './i18n'
import { Flash, HitStop, Particles, Shake, clamp, haptic, rand, runLoop, setupCanvas, type Stage } from './engine/juice'

const HUES = [330, 300, 270, 200, 180, 150, 50, 20]
const OVERDRIVE_N = 5
const OVERDRIVE_WINDOW = 1.5

interface Bubble {
  x: number
  y: number
  hue: number
  alive: boolean
  s: number // scale (spring)
  sv: number
  wob: number // squash amount (spring)
  wv: number
  delay: number // seconds before it starts growing back
  regrowAt: number
  popAt: number // scheduled chain pop time, -1 = none
  phase: number
}

interface Ring {
  x: number
  y: number
  r: number
  v: number
  life: number
  max: number
  hue: number
  w: number
}

export function startGame(canvas: HTMLCanvasElement, onFirst: () => void): () => void {
  let bubbles: Bubble[] = []
  let R = 28
  const sprites = new Map<number, HTMLCanvasElement>()
  let needLayout = true
  const { stage, dispose } = setupCanvas(canvas, () => (needLayout = true))
  const shake = new Shake(26, 0.04, 1.8)
  const stop = new HitStop()
  const flash = new Flash()
  const parts = new Particles(3000)
  let rings: Ring[] = []

  let time = 0
  let started = false
  let pointerDown = false
  let combo = 0
  let lastPop = -1
  let popTimes: number[] = []
  let armed = false
  let chaining = false
  let chainCount = 0
  let chainNote = 0
  let lastChainSound = -1
  let resetAt = -1
  let banner = { text: '', t: 0, hue: 0 }

  function makeSprite(hue: number, s: Stage) {
    const size = Math.ceil(R * 2.4 * s.dpr)
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')!
    g.scale(s.dpr, s.dpr)
    const m = R * 1.2
    const body = g.createRadialGradient(m - R * 0.3, m - R * 0.3, R * 0.1, m, m, R)
    body.addColorStop(0, `hsla(${hue},100%,85%,0.55)`)
    body.addColorStop(0.6, `hsla(${hue},100%,60%,0.22)`)
    body.addColorStop(0.92, `hsla(${hue},100%,60%,0.45)`)
    body.addColorStop(1, `hsla(${hue},100%,70%,0.95)`)
    g.fillStyle = body
    g.beginPath()
    g.arc(m, m, R, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = `hsla(${hue},100%,75%,0.9)`
    g.lineWidth = 2
    g.stroke()
    // specular highlight
    g.fillStyle = 'rgba(255,255,255,0.75)'
    g.beginPath()
    g.ellipse(m - R * 0.38, m - R * 0.42, R * 0.22, R * 0.12, -0.7, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.4)'
    g.beginPath()
    g.arc(m + R * 0.42, m + R * 0.4, R * 0.07, 0, Math.PI * 2)
    g.fill()
    return c
  }

  function layout(s: Stage) {
    const { w, h } = s
    R = clamp(Math.min(w, h) / 13, 20, 38)
    sprites.clear()
    for (const hue of HUES) sprites.set(hue, makeSprite(hue, s))
    const dx = R * 2.06
    const dy = dx * 0.866
    bubbles = []
    const cx = w / 2
    const cy = h / 2
    for (let row = 0, y = R * 0.9; y < h + R * 0.5; row++, y += dy)
      for (let x = (row % 2 ? dx / 2 : 0) + R * 0.6; x < w + R * 0.5; x += dx) {
        const d = Math.hypot(x - cx, y - cy)
        bubbles.push({
          x,
          y,
          hue: HUES[(Math.floor(x / dx) + row * 3) % HUES.length],
          alive: true,
          s: 0,
          sv: 0,
          wob: 0,
          wv: 0,
          delay: d / 1500,
          regrowAt: -1,
          popAt: -1,
          phase: rand(0, 10),
        })
      }
  }

  const ring = (x: number, y: number, v: number, life: number, hue: number, w: number) => rings.push({ x, y, r: R * 0.6, v, life, max: life, hue, w })

  function pop(b: Bubble, chain: boolean) {
    b.alive = false
    b.popAt = -1
    b.regrowAt = chain ? -1 : time + 3.5
    // neighbours jiggle
    for (const o of bubbles) {
      if (!o.alive || o === b) continue
      const d = Math.hypot(o.x - b.x, o.y - b.y)
      if (d < R * 2.4) {
        o.wv += (chain ? 2 : 2.8) * (Math.random() < 0.5 ? 1 : -1)
        o.sv -= 3
      }
    }
    const n = chain ? 8 : 16
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2)
      const sp = rand(180, 420) * (chain ? 1.4 : 1)
      parts.spawn({ x: b.x + Math.cos(a) * R * 0.8, y: b.y + Math.sin(a) * R * 0.8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.6), size: rand(3, 6), hue: b.hue, light: 70, grav: 600, drag: 0.93 })
    }
    ring(b.x, b.y, chain ? 260 : 340, 0.3, b.hue, chain ? 3 : 4)
    if (chain) {
      chainCount++
      shake.trauma = Math.min(0.75, shake.trauma + 0.02)
      if (time - lastChainSound > 0.018) {
        lastChainSound = time
        chainNote++
        audio.pop(pentaFreq((chainNote % 18) + 3, 196), 0.18)
        if (chainNote % 4 === 0) audio.chime(pentaFreq((chainNote % 15) + 8, 196), 0.06, (b.x / stage.w) * 1.6 - 0.8)
      }
      if (chainCount % 25 === 0) haptic(10)
      return
    }
    combo = time - lastPop < 0.5 ? combo + 1 : 0
    lastPop = time
    audio.pop(pentaFreq(combo % 15, 262), 0.32)
    shake.add(0.08 + Math.min(0.15, combo * 0.01))
    haptic(12)
    if (!armed && !chaining) {
      popTimes.push(time)
      popTimes = popTimes.filter((t) => time - t < OVERDRIVE_WINDOW)
      if (popTimes.length >= OVERDRIVE_N) arm()
    }
  }

  function arm() {
    armed = true
    popTimes = []
    banner = { text: 'OVERDRIVE!', t: 1, hue: 50 }
    audio.chord([pentaFreq(5, 262), pentaFreq(7, 262), pentaFreq(9, 262), pentaFreq(10, 262)], 0.6, 0.1, 0.05)
    audio.subDrop(0.35)
    flash.fire(0.25, '255,220,120')
    haptic([20, 15, 20, 15, 40])
    for (const b of bubbles) if (b.alive) b.wv += rand(-1.5, 1.5)
  }

  function detonate(x: number, y: number) {
    armed = false
    chaining = true
    chainCount = 0
    chainNote = 0
    stop.trigger(55)
    flash.fire(0.6)
    shake.add(0.7)
    audio.boom(0.75)
    haptic([30, 20, 80])
    const far = Math.max(Math.hypot(x, y), Math.hypot(stage.w - x, y), Math.hypot(x, stage.h - y), Math.hypot(stage.w - x, stage.h - y))
    const speed = far / 1.6
    for (const b of bubbles) if (b.alive) b.popAt = time + Math.hypot(b.x - x, b.y - y) / speed + rand(0, 0.08)
    ring(x, y, speed, 1.7, 50, 22)
    ring(x, y, speed * 0.85, 1.7, 300, 10)
    parts.burst(x, y, 200, { speed: 1300, life: 1, size: 5 })
  }

  function finale() {
    chaining = false
    banner = { text: `×${chainCount} CHAIN!`, t: 1, hue: 300 }
    track('overdrive_chain', { bubbles: chainCount })
    stats.n = Math.max(stats.n ?? 0, chainCount)
    flash.fire(0.7, '255,210,255')
    shake.add(0.8)
    stop.trigger(45)
    audio.boom(0.6)
    audio.chord([pentaFreq(10, 131), pentaFreq(12, 131), pentaFreq(13, 131), pentaFreq(15, 131), pentaFreq(17, 131)], 1.6, 0.12, 0.025)
    haptic([40, 30, 120])
    for (let i = 0; i < 6; i++) parts.burst(rand(0, stage.w), rand(0, stage.h), 80, { speed: 900, life: 1.1, size: 5 })
    resetAt = time + 0.45
  }

  function resetAll() {
    const cx = stage.w / 2
    const cy = stage.h / 2
    for (const b of bubbles) {
      b.alive = true
      b.s = 0
      b.sv = 0
      b.regrowAt = -1
      b.delay = Math.hypot(b.x - cx, b.y - cy) / 2200
    }
    audio.whoosh(0.3)
  }

  const hitAt = (x: number, y: number) => {
    for (const b of bubbles) if (b.alive && b.delay <= 0 && b.popAt < 0 && Math.hypot(b.x - x, b.y - y) < R * Math.max(0.6, b.s) + 3) pop(b, false)
  }

  const onDown = (e: PointerEvent) => {
    audio.unlock()
    if (!started) {
      started = true
      onFirst()
    }
    pointerDown = true
    canvas.setPointerCapture?.(e.pointerId)
    if (armed) detonate(e.clientX, e.clientY)
    else if (!chaining) hitAt(e.clientX, e.clientY)
  }
  const onMove = (e: PointerEvent) => {
    if (pointerDown && !chaining && !armed) hitAt(e.clientX, e.clientY)
  }
  const onUp = () => (pointerDown = false)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  const update = (dt: number) => {
    time += dt
    if (needLayout) {
      needLayout = false
      layout(stage)
    }
    let pending = 0
    for (const b of bubbles) {
      if (b.popAt > 0) {
        pending++
        if (time >= b.popAt) pop(b, true)
      }
      if (!b.alive && b.regrowAt > 0 && time >= b.regrowAt) {
        b.alive = true
        b.s = 0
        b.sv = 0
        b.regrowAt = -1
      }
      if (!b.alive) continue
      if (b.delay > 0) {
        b.delay -= dt
        continue
      }
      // springs: scale → 1, squash → 0
      b.sv += (300 * (1 - b.s) - 11 * b.sv) * dt
      b.s += b.sv * dt
      b.wv += (-500 * b.wob - 10 * b.wv) * dt
      b.wob += b.wv * dt
    }
    if (chaining && pending === 0) finale()
    if (resetAt > 0 && time >= resetAt) {
      resetAt = -1
      resetAll()
    }
    popTimes = popTimes.filter((t) => time - t < OVERDRIVE_WINDOW)
    parts.update(dt)
    for (const r of rings) {
      r.r += r.v * dt
      r.life -= dt
    }
    rings = rings.filter((r) => r.life > 0)
    banner.t = Math.max(0, banner.t - dt * 0.8)
  }

  const draw = (now: number) => {
    const { ctx, w, h, dpr } = stage
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0a0614'
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    shake.apply(ctx, w, h, now)
    const t = now / 1000
    const size = R * 2.4
    for (const b of bubbles) {
      if (!b.alive || b.delay > 0 || b.s <= 0.01) continue
      const breathe = 1 + Math.sin(t * 2.2 + b.phase) * 0.025 + (armed ? Math.sin(t * 40 + b.phase) * 0.03 : 0)
      const sx = b.s * breathe * (1 + b.wob)
      const sy = b.s * breathe * (1 - b.wob)
      const img = sprites.get(b.hue)!
      ctx.drawImage(img, b.x - (size * sx) / 2, b.y - (size * sy) / 2, size * sx, size * sy)
    }
    ctx.globalCompositeOperation = 'lighter'
    for (const r of rings) {
      const k = r.life / r.max
      ctx.strokeStyle = `hsla(${r.hue},100%,70%,${k})`
      ctx.lineWidth = Math.max(0.5, r.w * k)
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
    parts.draw(ctx)

    if (banner.t > 0) {
      const m = Math.min(w, h)
      ctx.save()
      ctx.translate(w / 2, h * 0.42)
      const s = 1 + (1 - banner.t) * 0.3
      ctx.scale(s, s)
      ctx.globalAlpha = Math.min(1, banner.t * 2.2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `900 ${Math.round(m * 0.12)}px system-ui, sans-serif`
      ctx.fillStyle = `hsl(${banner.hue},100%,60%)`
      ctx.fillText(banner.text, 4, 4)
      ctx.fillStyle = '#fff'
      ctx.fillText(banner.text, 0, 0)
      ctx.restore()
    }
    ctx.restore()

    // overdrive meter
    const n = armed ? OVERDRIVE_N : popTimes.length
    ctx.fillStyle = 'rgba(10,6,20,0.7)'
    ctx.beginPath()
    ctx.roundRect(w / 2 - 54, 8, 108, 24, 12)
    ctx.fill()
    for (let i = 0; i < OVERDRIVE_N; i++) {
      const x = w / 2 + (i - (OVERDRIVE_N - 1) / 2) * 18
      ctx.beginPath()
      ctx.arc(x, 20, 5, 0, Math.PI * 2)
      ctx.fillStyle = i < n ? (armed ? `hsl(${50 + Math.sin(t * 20) * 10},100%,60%)` : 'rgba(255,255,255,0.85)') : 'rgba(255,255,255,0.15)'
      ctx.fill()
    }
    if (armed) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 14)
      ctx.strokeStyle = `rgba(255,210,60,${0.45 + 0.45 * pulse})`
      ctx.lineWidth = 6 + 6 * pulse
      ctx.strokeRect(0, 0, w, h)
      ctx.font = '800 13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(255,220,90,${0.6 + 0.4 * pulse})`
      ctx.fillText(tr('pop_armed'), w / 2, 44)
    }
    flash.draw(ctx, w, h)
  }

  const stopLoop = runLoop((dt, now) => {
    if (!stop.active) {
      update(dt)
      shake.update(dt)
      flash.update(dt)
    }
    draw(now)
  })

  return () => {
    stopLoop()
    dispose()
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onUp)
  }
}
