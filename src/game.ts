// Chain Pop: a sheet of parcel bubble wrap. Pop cells one by one; five fast pops arm the wring, which flattens
// the whole sheet in a straight twisting front. One cell per sheet is a dud that only squeaks until the fifth press.
// A finished sheet is peeled off, and the next one is already lying underneath.
import { audio, pentaFreq } from './engine/AudioEngine'
import { track } from './analytics'
import { peakEvery, stats } from './share'
import { t as tr } from './i18n'
import { Flash, Shake, clamp, haptic, runLoop, setupCanvas, type Stage } from './engine/juice'
import { FONT, SPRITE, bakeBox, bakeFilm, makeDome, makePopped, rng, type WrapLayout } from './wrap'

const DOME_VARIANTS = 3
const POP_VARIANTS = 10 // 4 of them show no tear (see makePopped)
const OVERDRIVE_N = 5
const OVERDRIVE_WINDOW = 1.5
const SQUASH = 0.03 // s under the finger before the dome gives
const PUFF = 0.14
const DUD_PRESSES = 5
const DUD_WAIT = 4 // s the sheet waits for the player once only the dud is left
const PEEL = 0.35
const WRING_ANGLE = (-30 * Math.PI) / 180
const INK = '74,58,44' // #4A3A2C
const CREAM = '255,249,240' // #FFF9F0

interface Cell {
  x: number
  y: number
  row: number
  col: number
  dv: number // dome variant
  pv: number // popped variant
  rot: number // popped sprite rotation
  alive: boolean
  squashAt: number // time the finger landed, -1 = not squashing
  popAt: number // scheduled wring pop, -1 = none
  wobAt: number // dud only: when the wring front passes it
  wob: number // squash (spring)
  wv: number
  phase: number
  // dud only
  dent: number // 0..1 spring
  dv2: number
  dx: number // unit vector away from the finger
  dy: number
  tilt: number // crescent moves each press
}

interface Puff {
  x: number
  y: number
  age: number
}

interface Line {
  text: string
  x: number
  y: number
  age: number
  dur: number // < 0: holds until the sheet changes
  rise: number
}

const easeInCubic = (x: number) => x * x * x

export function startGame(canvas: HTMLCanvasElement, onFirst: () => void): () => void {
  const q = new URLSearchParams(location.search)
  const DEV = import.meta.env.DEV
  const OG = q.get('og') === '1'
  const seed = Number(q.get('seed') ?? 0) || Math.floor(Math.random() * 1e9)
  const startPopped = clamp(Number(q.get('popped') ?? (OG ? 0.3 : 0)) || 0, 0, 1)
  const rnd = q.has('seed') ? rng(seed ^ 0x5bd1e995) : Math.random
  const rr = (a: number, b: number) => a + rnd() * (b - a)

  let R = 28
  let cells: Cell[] = []
  let dud: Cell | null = null
  let domes: HTMLCanvasElement[] = []
  let specs: HTMLCanvasElement[] = []
  let flats: HTMLCanvasElement[] = []
  let mini: { dome: HTMLCanvasElement; flat: HTMLCanvasElement } | null = null
  let box: HTMLCanvasElement | null = null
  let film: HTMLCanvasElement | null = null
  // box + film + every flattened cell, stamped once when it pops: one full-screen blit per frame
  let ground: HTMLCanvasElement | null = null
  let gctx: CanvasRenderingContext2D | null = null
  let rowY: number[] = []
  let needLayout = true
  let ready = false
  const { stage, dispose } = setupCanvas(canvas, () => (needLayout = true))
  const shake = new Shake(18, 0.02, 1.8)
  const flash = new Flash()

  let time = 0
  let stopT = 0 // hit-stop, sim seconds
  let started = false
  let pointerDown = false
  let combo = 0
  let lastPop = -1
  let popTimes: number[] = []
  let armed = false
  let armedAt = 0
  let chaining = false
  let wring = { x: 0, y: 0, t0: 0, speed: 1, nx: 0, ny: 0, max: 0 }
  let chainCount = 0
  let chainNote = 0
  let lastChainSound = -1
  let banner = { text: '', t: 0 }
  let puffs: Puff[] = []
  let lines: Line[] = []
  let sheetN = 1
  let sheetStart = 0
  let wrung = false
  let dudWaitUntil = -1 // > 0 while only the dud is left
  let lastLineAt = -1 // when to show pop_last
  let doneAt = -1 // when to peel
  let peel: { t: number; snap: HTMLCanvasElement } | null = null
  let underFade = 0 // next sheet brightness: 0.04 → 0
  let glare = { t0: -10, next: rr(2.5, 4) } // idle glare band
  let dudInside = false

  const seedOf = (n: number) => (seed + n * 1013) >>> 0

  function newSheet(n: number, popped: number) {
    const r = rng(seedOf(n))
    const dx = R * 2.06
    for (const c of cells) {
      c.dv = Math.floor(r() * DOME_VARIANTS)
      c.pv = Math.floor(r() * POP_VARIANTS)
      c.rot = r() * Math.PI * 2
      c.alive = true
      c.squashAt = -1
      c.popAt = -1
      c.wobAt = -1
      c.wob = 0
      c.wv = 0
      c.dent = 0
      c.dv2 = 0
      c.tilt = 0
      c.phase = r() * 10
    }
    // the dud: not in the outer two rings of cells
    const rows = rowY.length
    const inner = cells.filter((c) => c.row >= 2 && c.row <= rows - 3 && c.x > dx * 1.9 && c.x < stage.w - dx * 1.9)
    const pool = inner.length ? inner : cells
    dud = pool[Math.floor(r() * pool.length)]
    dudPresses = 0
    for (const c of cells) if (c !== dud && r() < popped) c.alive = false
    sheetStart = time
    wrung = false
    dudWaitUntil = -1
    lastLineAt = -1
    doneAt = -1
    lines = []
    redrawGround()
  }

  function stampFlat(g: CanvasRenderingContext2D, c: Cell) {
    const size = R * SPRITE
    g.save()
    g.translate(c.x, c.y)
    g.rotate(c.rot)
    g.drawImage(flats[c.pv], -size / 2, -size / 2, size, size)
    g.restore()
  }

  function redrawGround() {
    if (!gctx || !box || !film) return
    const { w, h, dpr } = stage
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    gctx.drawImage(box, 0, 0, w, h)
    gctx.drawImage(film, 0, 0, w, h)
    for (const c of cells) if (!c.alive) stampFlat(gctx, c)
  }
  let dudPresses = 0

  function layout(s: Stage) {
    const { w, h, dpr } = s
    R = clamp(Math.min(w, h) / 13, 20, 38)
    domes = Array.from({ length: DOME_VARIANTS }, (_, v) => makeDome(R, dpr, v))
    specs = Array.from({ length: DOME_VARIANTS }, (_, v) => makeDome(R, dpr, v, true))
    flats = Array.from({ length: POP_VARIANTS }, (_, v) => makePopped(R, dpr, v))
    mini = { dome: makeDome(5, dpr, 0), flat: makePopped(5, dpr, 1) }
    const dx = R * 2.06
    const dy = dx * 0.866
    const old = cells
    cells = []
    rowY = []
    for (let row = 0, y = R * 0.9; y < h + R * 0.5; row++, y += dy) {
      rowY.push(y)
      for (let col = 0, x = (row % 2 ? dx / 2 : 0) + R * 0.6; x < w + R * 0.5; col++, x += dx)
        cells.push({ x, y, row, col, dv: 0, pv: 0, rot: 0, alive: true, squashAt: -1, popAt: -1, wobAt: -1, wob: 0, wv: 0, phase: 0, dent: 0, dv2: 0, dx: 0, dy: 0, tilt: 0 })
    }
    const L: WrapLayout = { w, h, R, dpr, rowY, fragile: tr('pop_fragile'), seed }
    box = bakeBox(L)
    film = bakeFilm(L)
    ground = document.createElement('canvas')
    ground.width = Math.round(w * dpr)
    ground.height = Math.round(h * dpr)
    gctx = ground.getContext('2d')!
    // a resize mid-sheet starts the same sheet fresh (the grid changed); never mid-chain
    chaining = false
    armed = false
    peel = null
    newSheet(sheetN, old.length ? 0 : startPopped)
    ready = true
  }

  const panOf = (x: number) => (x / stage.w) * 1.6 - 0.8

  function jiggle(c: Cell, kick: number) {
    for (const o of cells) {
      if (!o.alive || o === c) continue
      if (Math.abs(o.x - c.x) > R * 2.4 || Math.abs(o.y - c.y) > R * 2.4) continue
      if (Math.hypot(o.x - c.x, o.y - c.y) < R * 2.4) o.wv += kick * (rnd() < 0.5 ? 1 : -1)
    }
  }

  /** The dome gives: swap to the flat sprite and puff. */
  function flatten(c: Cell, chain: boolean) {
    c.alive = false
    c.squashAt = -1
    c.popAt = -1
    if (gctx) stampFlat(gctx, c)
    puffs.push({ x: c.x, y: c.y, age: 0 })
    jiggle(c, chain ? 0.8 : 1.2)
  }

  function press(c: Cell, fx: number, fy: number) {
    if (c === dud) return dudPress(c, fx, fy)
    c.squashAt = time
    combo = time - lastPop < 0.5 ? combo + 1 : 0
    lastPop = time
    audio.wrapPop(1, panOf(c.x), 650 + (1400 - 650) * Math.min(1, combo / 15))
    shake.add(0.04)
    haptic(12)
    if (!armed && !chaining) {
      popTimes.push(time)
      popTimes = popTimes.filter((t) => time - t < OVERDRIVE_WINDOW)
      if (popTimes.length >= OVERDRIVE_N) arm()
    }
  }

  function dudPress(c: Cell, fx: number, fy: number) {
    dudPresses++
    if (dudWaitUntil > 0) dudWaitUntil = time + DUD_WAIT
    if (dudPresses < DUD_PRESSES) {
      const d = Math.hypot(c.x - fx, c.y - fy) || 1
      c.dx = (c.x - fx) / d
      c.dy = (c.y - fy) / d
      c.dent = 1
      c.dv2 = 0
      c.tilt += (dudPresses % 2 ? 1 : -1) * rr(0.22, 0.34)
      audio.squeak(panOf(c.x))
      haptic(6)
      return
    }
    // fifth press: finally
    c.squashAt = time
    audio.wrapPop(1, panOf(c.x), 650)
    audio.wrapPop(0.8, panOf(c.x), 520, 0.04)
    audio.tone({ freq: 784, dur: 0.25, gain: 0.1, delay: 0.06 })
    audio.tone({ freq: 1175, dur: 0.25, gain: 0.1, delay: 0.2 })
    haptic([12, 30, 20])
    lines = lines.filter((l) => l.dur > 0)
    lines.push({ text: tr('pop_dud_done'), x: c.x, y: c.y - R * 0.9, age: 0, dur: 0.9, rise: R * 1.2 })
    track('dud_pop', { sheet: sheetN })
  }

  function arm() {
    armed = true
    armedAt = time
    popTimes = []
    banner = { text: tr('pop_wring'), t: 1 }
    audio.chord([pentaFreq(5, 262), pentaFreq(7, 262), pentaFreq(9, 262), pentaFreq(10, 262)], 0.6, 0.1, 0.05)
    audio.subDrop(0.3)
    haptic([20, 15, 20, 15, 40])
    for (const c of cells) if (c.alive) c.wv += rr(-1, 1)
  }

  function detonate(x: number, y: number) {
    armed = false
    chaining = true
    wrung = true
    chainCount = 0
    chainNote = 0
    stopT = 0.055
    flash.fire(0.25, '255,246,230')
    shake.add(0.7)
    audio.boom(0.4)
    haptic([30, 20, 80])
    // a twist: the front is a straight line through the tap at -30 deg, moving out both ways
    const nx = -Math.sin(WRING_ANGLE)
    const ny = Math.cos(WRING_ANGLE)
    const dist = (px: number, py: number) => Math.abs((px - x) * nx + (py - y) * ny)
    const far = Math.max(dist(0, 0), dist(stage.w, 0), dist(0, stage.h), dist(stage.w, stage.h))
    const speed = far / 1.6
    wring = { x, y, t0: time, speed, nx, ny, max: far }
    for (const c of cells) {
      if (!c.alive || c.squashAt >= 0) continue
      const at = time + dist(c.x, c.y) / speed + rr(0, 0.06)
      if (c === dud) c.wobAt = at
      else c.popAt = at
    }
  }

  function finale() {
    chaining = false
    banner = { text: `×${chainCount} CHAIN!`, t: 1 }
    track('overdrive_chain', { bubbles: chainCount })
    stats.n = Math.max(stats.n ?? 0, chainCount)
    flash.fire(0.2, '255,246,230')
    shake.add(0.4)
    stopT = 0.045
    audio.chord([pentaFreq(10, 131), pentaFreq(12, 131), pentaFreq(13, 131), pentaFreq(15, 131), pentaFreq(17, 131)], 1.6, 0.12, 0.025)
    haptic([40, 30, 120])
  }

  function startPeel() {
    const { w, h, dpr } = stage
    // snapshot the leaving film and cells
    const snap = document.createElement('canvas')
    snap.width = Math.round(w * dpr)
    snap.height = Math.round(h * dpr)
    const g = snap.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawSheet(g, 0, true)
    // the film's cut edge along the bottom
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.fillRect(0, h - 1.5, w, 1.5)
    const left = dud && dud.alive
    track('sheet_done', { sheet: sheetN, seconds: Math.round(time - sheetStart), wrung: wrung ? 1 : 0 })
    if (left) track('dud_left', { sheet: sheetN })
    peakEvery('pop', sheetN, { snap, data: { cells: cells.length, s: Math.round((time - sheetStart) * 10) / 10, dud: left ? 1 : 0, wrung: wrung ? 1 : 0 } })
    audio.tear()
    haptic(15)
    sheetN++
    newSheet(sheetN, 0)
    peel = { t: 0, snap }
    underFade = 0.04
    banner.t = 0
  }

  const cellAt = (x: number, y: number) => {
    for (const c of cells) if (c.alive && c.squashAt < 0 && c.popAt < 0 && Math.abs(c.x - x) < R && Math.abs(c.y - y) < R && Math.hypot(c.x - x, c.y - y) < R + 3) return c
    return null
  }

  const hitAt = (x: number, y: number, fresh: boolean) => {
    const c = cellAt(x, y)
    if (c && c === dud) {
      // drag-popping over the dud counts once per pass
      if (!fresh && dudInside) return
      dudInside = true
      press(c, x, y)
      return
    }
    dudInside = false
    if (c) press(c, x, y)
  }

  const busy = () => chaining || !!peel || doneAt > 0

  function onPress(x: number, y: number) {
    if (peel) return
    if (armed) detonate(x, y)
    else if (!chaining) hitAt(x, y, true)
  }

  const onDown = (e: PointerEvent) => {
    audio.unlock()
    if (!started) {
      started = true
      onFirst()
    }
    pointerDown = true
    canvas.setPointerCapture?.(e.pointerId)
    dudInside = false
    onPress(e.clientX, e.clientY)
  }
  const onMove = (e: PointerEvent) => {
    if (pointerDown && !busy() && !armed) hitAt(e.clientX, e.clientY, false)
  }
  const onUp = () => {
    pointerDown = false
    dudInside = false
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)

  const update = (dt: number) => {
    if (stopT > 0) {
      stopT -= dt
      return
    }
    time += dt
    let pending = 0
    let intact = 0
    for (const c of cells) {
      if (c.popAt > 0) {
        pending++
        if (time >= c.popAt) {
          c.popAt = -1
          c.squashAt = time
          chainCount++
          shake.trauma = Math.min(0.5, shake.trauma + 0.01)
          if (time - lastChainSound > 0.018) {
            lastChainSound = time
            chainNote++
            const prog = clamp((time - wring.t0) / 1.6, 0, 1)
            audio.wrapPop(0.6, panOf(c.x), 650 + (2000 - 650) * prog)
            if (chainNote % 4 === 0) audio.chime(pentaFreq((chainNote % 15) + 8, 196), 0.04, panOf(c.x))
          }
          if (chainCount % 25 === 0) haptic(10)
        }
      }
      if (c.wobAt > 0 && time >= c.wobAt) {
        c.wobAt = -1
        c.wv += 4
        c.dent = 0.6
        c.dx = wring.nx
        c.dy = wring.ny
      }
      if (c.squashAt >= 0 && time - c.squashAt >= SQUASH) {
        if (c === dud) dudPresses = DUD_PRESSES
        flatten(c, c !== dud && wrung && chaining)
      }
      if (!c.alive) continue
      if (c !== dud) intact++
      c.wv += (-500 * c.wob - 10 * c.wv) * dt
      c.wob += c.wv * dt
      if (c === dud) {
        c.dv2 += (-300 * c.dent - 11 * c.dv2) * dt
        c.dent += c.dv2 * dt
      }
    }
    if (chaining && pending === 0 && cells.every((c) => c.squashAt < 0)) finale()

    // sheet state: everything but the dud flat → the dud beat; everything flat → peel
    if (!chaining && !peel && doneAt < 0 && intact === 0 && cells.every((c) => c.squashAt < 0)) {
      if (dud && dud.alive) {
        if (dudWaitUntil < 0) {
          dudWaitUntil = time + 0.4 + DUD_WAIT
          lastLineAt = time + 0.4
          armed = false
        }
      } else doneAt = time + (wrung && dudWaitUntil < 0 ? 0.45 : 0.6)
    }
    if (lastLineAt > 0 && time >= lastLineAt && dud) {
      lastLineAt = -1
      if (dud.alive) {
        const right = dud.x + R * 1.3
        const txt = tr('pop_last')
        stage.ctx.font = `600 ${Math.round(R * 0.5)}px ${FONT}`
        const tw = stage.ctx.measureText(txt).width
        const x = right + tw < stage.w - 8 ? right + tw / 2 : dud.x - R * 1.3 - tw / 2
        lines.push({ text: txt, x: clamp(x, tw / 2 + 8, stage.w - tw / 2 - 8), y: dud.y, age: 0, dur: -1, rise: R * 0.2 })
      }
    }
    if (dudWaitUntil > 0 && dud && dud.alive && time >= dudWaitUntil) doneAt = time
    if (doneAt > 0 && time >= doneAt) {
      doneAt = -1
      startPeel()
    }
    if (peel) {
      peel.t += dt
      if (peel.t >= PEEL) peel = null
    } else if (underFade > 0) underFade = Math.max(0, underFade - (0.04 / 0.2) * dt)

    popTimes = popTimes.filter((t) => time - t < OVERDRIVE_WINDOW)
    for (const p of puffs) p.age += dt
    puffs = puffs.filter((p) => p.age < PUFF)
    for (const l of lines) l.age += dt
    lines = lines.filter((l) => l.dur < 0 || l.age < l.dur)
    banner.t = Math.max(0, banner.t - dt * 0.8)
    // idle glare: every 6 to 9 s a band crosses the sheet in 900 ms
    if (!armed && time >= glare.next) glare = { t0: time, next: time + 0.9 + rr(6, 9) }
  }

  /** Where the glare band is (distance along the diagonal), or null. */
  const glarePos = (): number | null => {
    const diag = stage.w + stage.h
    if (armed) return (((time - armedAt) % 0.5) / 0.5) * (diag + 4 * R) - 2 * R
    const k = (time - glare.t0) / 0.9
    if (k < 0 || k > 1) return null
    return k * (diag + 4 * R) - 2 * R
  }

  /** Domes, over the ground. With `withFlat` also the film and the flat cells (the peel snapshot, no box). */
  function drawSheet(ctx: CanvasRenderingContext2D, t: number, withFlat = false, squeeze = 0) {
    const { w, h } = stage
    if (withFlat) {
      if (film) ctx.drawImage(film, 0, 0, w, h)
      for (const c of cells) if (!c.alive) stampFlat(ctx, c)
    }
    const size = R * SPRITE
    const gp = peel ? null : glarePos()
    for (const c of cells) {
      if (!c.alive) continue
      let sx = 1 + c.wob
      let sy = 1 - c.wob
      let ox = squeeze ? (wring.x - c.x) * squeeze : 0
      let oy = 0
      if (armed) {
        const tm = Math.sin(t * 40 + c.phase) * 0.03
        sx += tm
        sy += tm
      }
      if (c.squashAt >= 0) {
        const k = clamp((time - c.squashAt) / SQUASH, 0, 1)
        sx *= 1 + 0.12 * k
        sy *= 1 - 0.2 * k
      }
      if (c === dud && Math.abs(c.dent) > 0.001) {
        sx *= 1 + 0.15 * c.dent
        sy *= 1 - 0.3 * c.dent
        ox += c.dx * 0.08 * R * c.dent
        oy += c.dy * 0.08 * R * c.dent
      }
      const img = domes[c.dv]
      if (c === dud && c.tilt) {
        ctx.save()
        ctx.translate(c.x + ox, c.y + oy)
        ctx.rotate(c.tilt)
        ctx.drawImage(img, (-size * sx) / 2, (-size * sy) / 2, size * sx, size * sy)
        ctx.restore()
      } else ctx.drawImage(img, c.x + ox - (size * sx) / 2, c.y + oy - (size * sy) / 2, size * sx, size * sy)
      if (gp !== null) {
        const d = Math.abs(c.x + c.y - gp)
        if (d < 2.2 * R) {
          ctx.globalAlpha = 0.25 * (1 - d / (2.2 * R))
          ctx.drawImage(specs[c.dv], c.x + ox - (size * sx) / 2, c.y + oy - (size * sy) / 2, size * sx, size * sy)
          ctx.globalAlpha = 1
        }
      }
    }
  }

  function textLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, weight: number, alpha: number) {
    ctx.font = `${weight} ${px}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, px * 0.28)
    ctx.strokeStyle = `rgba(${CREAM},${0.9 * alpha})`
    ctx.strokeText(text, x, y)
    ctx.fillStyle = `rgba(${INK},${alpha})`
    ctx.fillText(text, x, y)
  }

  const draw = (now: number) => {
    const { ctx, w, h, dpr } = stage
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // the ground covers the canvas; under shake its edge would show, so fill first only then
    if (!ground || shake.trauma > 0) {
      ctx.fillStyle = '#C9A77A'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.save()
    shake.apply(ctx, w, h, now)
    const t = now / 1000
    if (ground) ctx.drawImage(ground, 0, 0, w, h)

    // the sheet gathers a little towards the twist while the wring runs (domes only; the flat film stays put)
    const squeeze = chaining ? 0.015 * Math.sin(Math.PI * clamp((time - wring.t0) / 1.7, 0, 1)) : 0
    ctx.save()
    drawSheet(ctx, t, false, squeeze)
    if (underFade > 0) {
      ctx.fillStyle = `rgba(40,25,10,${underFade})`
      ctx.fillRect(0, 0, w, h)
    }
    // air puffs
    for (const p of puffs) {
      const k = p.age / PUFF
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - k)})`
      ctx.lineWidth = Math.max(1, R * 0.12 * (1 - k))
      ctx.beginPath()
      ctx.arc(p.x, p.y, R * (0.6 + 0.7 * k), 0, Math.PI * 2)
      ctx.stroke()
    }
    // the wring fronts: a bright band riding each side of the line
    if (chaining) {
      const d = (time - wring.t0) * wring.speed
      if (d < wring.max + R) {
        ctx.save()
        ctx.translate(wring.x, wring.y)
        ctx.rotate(WRING_ANGLE)
        const L = w + h
        const bw = 1.2 * R
        for (const s of [-1, 1]) {
          const y0 = s * d
          const g = ctx.createLinearGradient(0, y0 - bw / 2, 0, y0 + bw / 2)
          g.addColorStop(0, 'rgba(255,255,255,0)')
          g.addColorStop(0.5, 'rgba(255,255,255,0.18)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.fillRect(-L, y0 - bw / 2, 2 * L, bw)
        }
        ctx.restore()
      }
    }
    ctx.restore()

    // the leaving sheet, peeling up and off
    if (peel) {
      const k = easeInCubic(clamp(peel.t / PEEL, 0, 1))
      const ty = -1.1 * h * k
      ctx.save()
      ctx.translate(w / 2, h + ty)
      ctx.rotate((-3 * Math.PI * k) / 180)
      // shadow line following its lower edge
      const sg = ctx.createLinearGradient(0, 0, 0, R * 0.7)
      sg.addColorStop(0, 'rgba(60,40,20,0.28)')
      sg.addColorStop(1, 'rgba(60,40,20,0)')
      ctx.fillStyle = sg
      ctx.fillRect(-w, 0, 2 * w, R * 0.7)
      ctx.drawImage(peel.snap, -w / 2, -h, w, h)
      ctx.restore()
    }

    // floating lines
    for (const l of lines) {
      const k = l.dur > 0 ? l.age / l.dur : Math.min(1, l.age / 0.5)
      const a = l.dur > 0 ? (k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1) : Math.min(1, l.age / 0.25)
      textLine(ctx, l.text, l.x, l.y - l.rise * (l.dur > 0 ? Math.sin((k * Math.PI) / 2) : k), Math.round(R * 0.5), 600, a)
    }

    if (banner.t > 0) {
      const m = Math.min(w, h)
      ctx.save()
      ctx.translate(w / 2, h * 0.42)
      const s = 1 + (1 - banner.t) * 0.3
      ctx.scale(s, s)
      ctx.globalAlpha = Math.min(1, banner.t * 2.2)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let px = Math.round(m * 0.12)
      ctx.font = `900 ${px}px ${FONT}`
      const tw = ctx.measureText(banner.text).width
      if (tw > w * 0.84 / 1.3) px = Math.floor((px * w * 0.84) / 1.3 / tw)
      ctx.font = `900 ${px}px ${FONT}`
      ctx.fillStyle = `rgb(${CREAM})`
      ctx.fillText(banner.text, 3, 3)
      ctx.fillStyle = `rgb(${INK})`
      ctx.fillText(banner.text, 0, 0)
      ctx.restore()
    }
    ctx.restore()

    if (!OG) drawMeter(ctx, w, t)
    flash.draw(ctx, w, h)
  }

  function drawMeter(ctx: CanvasRenderingContext2D, w: number, t: number) {
    const n = armed ? OVERDRIVE_N : popTimes.length
    const label = tr('pop_sheet', { n: sheetN })
    ctx.font = `500 12px ${FONT}`
    const lw = ctx.measureText(label).width
    const dotsW = OVERDRIVE_N * 16 - 6
    const pw = 14 + dotsW + 12 + lw + 14
    const x0 = w / 2 - pw / 2
    ctx.fillStyle = `rgba(${CREAM},0.78)`
    ctx.beginPath()
    ctx.roundRect(x0, 8, pw, 28, 14)
    ctx.fill()
    ctx.strokeStyle = `rgba(${INK},0.12)`
    ctx.lineWidth = 1
    ctx.stroke()
    const ms = 5 * SPRITE
    for (let i = 0; i < OVERDRIVE_N; i++) {
      const cx = x0 + 14 + 5 + i * 16
      const cy = 22
      if (mini) {
        const filled = i < n
        const wob = armed ? Math.sin(t * 40 + i) * 0.06 : 0
        ctx.drawImage(filled ? mini.flat : mini.dome, cx - (ms * (1 + wob)) / 2, cy - (ms * (1 - wob)) / 2, ms * (1 + wob), ms * (1 - wob))
        if (!filled) {
          // a dome on cream needs a hint of kraft under it to read
          ctx.strokeStyle = `rgba(${INK},0.22)`
          ctx.beginPath()
          ctx.arc(cx, cy, 5, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillStyle = `rgba(${INK},0.18)`
          ctx.beginPath()
          ctx.arc(cx, cy, 4.6, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.fillStyle = `rgba(${INK},0.6)`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = `500 12px ${FONT}`
    ctx.fillText(label, x0 + 14 + dotsW + 12, 22.5)
    if (armed) {
      const text = tr('pop_armed')
      ctx.font = `700 13px ${FONT}`
      const tw = Math.min(ctx.measureText(text).width, w - 48)
      const pulse = 0.5 + 0.5 * Math.sin(t * 14)
      ctx.fillStyle = `rgba(${CREAM},0.85)`
      ctx.beginPath()
      ctx.roundRect(w / 2 - tw / 2 - 12, 42, tw + 24, 24, 12)
      ctx.fill()
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(${INK},${0.75 + 0.25 * pulse})`
      ctx.fillText(text, w / 2, 54.5, w - 48)
    }
  }

  let simNow = 0
  let frozen = false
  const step = (dt: number) => {
    if (needLayout) {
      needLayout = false
      layout(stage)
    }
    update(dt)
    shake.update(dt)
    flash.update(dt)
  }

  if (DEV) {
    const W = window as unknown as Record<string, unknown>
    const find = (row: number, col: number) => cells.find((o) => o.row === row && o.col === col)
    W.__toy = {
      seed,
      get ready() {
        return ready
      },
      R: () => R,
      freeze: () => (frozen = true),
      resume: () => (frozen = false),
      advance: (dt: number) => {
        step(dt)
        simNow += dt * 1000
        draw(simNow)
      },
      /** centre of the intact cell nearest (fx*w, fy*h), and of a popped cell with a popped neighbour */
      cells: (fx = 0.4, fy = 0.4) => {
        const near = (pred: (c: Cell) => boolean) => {
          let best: Cell | null = null
          let bd = Infinity
          for (const c of cells) {
            if (!pred(c)) continue
            const d = Math.hypot(c.x - fx * stage.w, c.y - fy * stage.h)
            if (d < bd) (bd = d), (best = c)
          }
          return best ? [best.x, best.y] : null
        }
        const poppedNb = (c: Cell) => !c.alive && cells.some((o) => o !== c && !o.alive && Math.hypot(o.x - c.x, o.y - c.y) < R * 2.2)
        return { R, intact: near((c) => c.alive && c !== dud), popped: near(poppedNb) }
      },
      popAt: (row: number, col: number) => {
        const c = find(row, col)
        if (c && c.alive) press(c, c.x, c.y - R * 0.3)
      },
      /** pointer press at (x, y), as a tap */
      tap: (x: number, y: number) => {
        if (!started) {
          started = true
          onFirst()
        }
        dudInside = false
        onPress(x, y)
      },
      arm: () => arm(),
      dud: () => (dud ? { row: dud.row, col: dud.col, x: dud.x, y: dud.y, presses: dudPresses, alive: dud.alive } : null),
      /** flatten everything but the dud (no sound), for the dud and peel sheets */
      flattenAll: (keepDud = true) => {
        for (const c of cells) if (c.alive && (c !== dud || !keepDud)) c.alive = false
        redrawGround()
      },
      state: () => ({ time, sheet: sheetN, armed, chaining, peel: peel ? peel.t : -1, chain: chainCount, intact: cells.filter((c) => c.alive).length, cells: cells.length, dudWait: dudWaitUntil, doneAt }),
    }
  }

  const stopLoop = runLoop((dt, now) => {
    if (frozen) {
      draw(simNow)
      return
    }
    simNow = now
    step(dt)
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
