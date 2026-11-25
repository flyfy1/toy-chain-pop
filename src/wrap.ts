// Parcel bubble wrap: baked kraft background (box, FRAGILE sticker, tape, film) and dome / popped-cell sprites.
// Light from the upper left. Everything is sized from R (never from w: on the desktop R is capped at 38 while w is 1440).
import { locale } from './i18n'

export const FONT = locale === 'ja' ? 'system-ui, "Hiragino Sans", "Noto Sans CJK JP", sans-serif' : 'system-ui, "PingFang SC", "Hiragino Sans", "Noto Sans CJK SC", sans-serif'

export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TAU = Math.PI * 2
const canvasOf = (wpx: number, hpx: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(wpx))
  c.height = Math.max(1, Math.ceil(hpx))
  return c
}

/** Sprite canvases are SPRITE*R wide (CSS px), centre at the middle. */
export const SPRITE = 2.6

export interface WrapLayout {
  w: number
  h: number
  R: number
  dpr: number
  /** y of each row centre, for the film seams */
  rowY: number[]
  fragile: string
  seed: number
}

/** Tape geometry, also used by the draw loop if it ever needs it. */
export function tapeGeom(L: WrapLayout) {
  const { w, R } = L
  const width = 4.2 * R
  // the sticker sits 7R in from the right; keep the tape over its left part at any width
  const stickerCx = w - 7 * R
  const x = Math.max(stickerCx - 3 * R, Math.min(stickerCx + 3 * R, 0.62 * w))
  return { x, width, angle: (2 * Math.PI) / 180 }
}

/** The box under the wrap: kraft, FRAGILE sticker, packing tape. Stays put when a sheet is peeled off. */
export function bakeBox(L: WrapLayout): HTMLCanvasElement {
  const { w, h, R, dpr } = L
  const r = rng(L.seed * 7919 + 13)
  const c = canvasOf(w * dpr, h * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)

  // 1. kraft cardboard
  g.fillStyle = '#C9A77A'
  g.fillRect(0, 0, w, h)
  const vig = g.createRadialGradient(w * 0.45, h * 0.42, Math.min(w, h) * 0.2, w / 2, h / 2, Math.hypot(w, h) * 0.62)
  vig.addColorStop(0, 'rgba(176,141,95,0)')
  vig.addColorStop(1, 'rgba(176,141,95,1)')
  g.fillStyle = vig
  g.fillRect(0, 0, w, h)
  // fibres: short, mostly horizontal strokes
  const nFib = Math.round(2500 * Math.max(1, (w * h) / (412 * 915) / 1.6))
  g.lineWidth = 1
  g.lineCap = 'round'
  for (let i = 0; i < nFib; i++) {
    const x = r() * w
    const y = r() * h
    const len = 6 + r() * 12
    const a = (r() - 0.5) * 0.35
    g.strokeStyle = i % 2 ? 'rgba(139,107,67,0.07)' : 'rgba(230,207,165,0.07)'
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
    g.stroke()
  }

  // 2. FRAGILE sticker, seen through the film: drawn at 85%
  const sw = 9 * R
  const sh = 3.1 * R
  const scx = w - 7 * R
  const scy = h - 8 * R
  g.save()
  g.globalAlpha = 0.85
  g.translate(scx, scy)
  g.rotate((-8 * Math.PI) / 180)
  g.shadowColor = 'rgba(70,50,25,0.25)'
  g.shadowBlur = R * 0.15
  g.shadowOffsetY = R * 0.04
  g.fillStyle = '#C62828'
  g.beginPath()
  g.roundRect(-sw / 2, -sh / 2, sw, sh, R * 0.18)
  g.fill()
  g.shadowColor = 'transparent'
  // white inner border
  g.strokeStyle = 'rgba(255,255,255,0.95)'
  g.lineWidth = Math.max(1.5, R * 0.07)
  g.beginPath()
  g.roundRect(-sw / 2 + R * 0.22, -sh / 2 + R * 0.22, sw - R * 0.44, sh - R * 0.44, R * 0.1)
  g.stroke()
  // broken wine glass on the left
  const gx = -sw / 2 + R * 1.25
  const gs = sh * 0.36
  g.strokeStyle = '#fff'
  g.fillStyle = '#fff'
  g.lineWidth = Math.max(1.4, R * 0.075)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.beginPath()
  // bowl
  g.moveTo(gx - gs * 0.5, -gs * 0.95)
  g.lineTo(gx + gs * 0.5, -gs * 0.95)
  g.quadraticCurveTo(gx + gs * 0.52, -gs * 0.05, gx, gs * 0.05)
  g.quadraticCurveTo(gx - gs * 0.52, -gs * 0.05, gx - gs * 0.5, -gs * 0.95)
  g.fill()
  // stem + foot
  g.beginPath()
  g.moveTo(gx, gs * 0.05)
  g.lineTo(gx, gs * 0.8)
  g.moveTo(gx - gs * 0.38, gs * 0.82)
  g.lineTo(gx + gs * 0.38, gs * 0.82)
  g.stroke()
  // crack through the bowl, in the sticker red
  g.strokeStyle = '#C62828'
  g.lineWidth = Math.max(1.2, R * 0.06)
  g.beginPath()
  g.moveTo(gx + gs * 0.12, -gs * 0.98)
  g.lineTo(gx - gs * 0.08, -gs * 0.62)
  g.lineTo(gx + gs * 0.1, -gs * 0.42)
  g.lineTo(gx - gs * 0.05, -gs * 0.15)
  g.stroke()
  // text
  const tx = gx + R * 0.85
  const maxW = sw / 2 - R * 0.45 - tx
  let fs = sh * 0.46
  g.font = `900 ${fs}px ${FONT}`
  const mw = g.measureText(L.fragile).width
  if (mw > maxW) fs *= maxW / mw
  g.font = `900 ${fs}px ${FONT}`
  g.fillStyle = '#fff'
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(L.fragile, tx, sh * 0.03)
  g.restore()

  // 3. clear packing tape, top to bottom, tilted 2 deg
  const tp = tapeGeom(L)
  g.save()
  g.translate(tp.x, h / 2)
  g.rotate(tp.angle)
  const H = h * 1.2
  // clear tape makes kraft look wet: darker and more saturated, then a thin gloss on top
  g.fillStyle = 'rgba(150,100,40,0.13)'
  g.fillRect(-tp.width / 2, -H / 2, tp.width, H)
  g.fillStyle = 'rgba(255,255,255,0.10)'
  g.fillRect(-tp.width / 2, -H / 2, tp.width, H)
  g.fillStyle = 'rgba(255,255,255,0.25)'
  g.fillRect(-tp.width / 2, -H / 2, 1, H)
  g.fillRect(tp.width / 2 - 1, -H / 2, 1, H)
  // edge shadows on the kraft
  g.fillStyle = 'rgba(90,65,35,0.10)'
  g.fillRect(tp.width / 2, -H / 2, 1.5, H)
  // three long glare streaks
  for (const [off, wd, a] of [
    [-0.28, 0.07, 0.16],
    [-0.12, 0.025, 0.2],
    [0.22, 0.04, 0.12],
  ] as const) {
    const sx = off * tp.width
    const gr = g.createLinearGradient(0, -H / 2, 0, H / 2)
    gr.addColorStop(0, 'rgba(255,255,255,0)')
    gr.addColorStop(0.3, `rgba(255,255,255,${a})`)
    gr.addColorStop(0.55, `rgba(255,255,255,${a * 0.4})`)
    gr.addColorStop(0.8, `rgba(255,255,255,${a})`)
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(sx, -H / 2, wd * tp.width, H)
  }
  g.restore()

  return c
}

/** The film between the cells: a light wash and a faint seam every 4 rows. Transparent canvas, peels with the cells. */
export function bakeFilm(L: WrapLayout): HTMLCanvasElement {
  const { w, h, dpr } = L
  const c = canvasOf(w * dpr, h * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  g.fillStyle = 'rgba(255,255,255,0.07)'
  g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,0.12)'
  for (let i = 2; i < L.rowY.length; i += 4) {
    const y = Math.round((L.rowY[i] + L.rowY[i - 1]) / 2)
    g.fillRect(0, y, w, 1)
  }
  return c
}

/** The specular crescent, lit from the upper left. */
function crescent(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, k: number) {
  g.save()
  g.translate(cx, cy)
  g.rotate(-0.7)
  // soft-edged crescent: a radial gradient squashed into the ellipse
  g.scale(0.34 * R * k, 0.13 * R * k)
  const sp = g.createRadialGradient(0, 0, 0, 0, 0, 1)
  sp.addColorStop(0, 'rgba(255,255,255,0.95)')
  sp.addColorStop(0.55, 'rgba(255,255,255,0.85)')
  sp.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sp
  g.beginPath()
  g.arc(0, 0, 1, 0, TAU)
  g.fill()
  g.restore()
}

/** Intact dome; `specOnly` bakes just the crescent (for the glare band). */
export function makeDome(R: number, dpr: number, v: number, specOnly = false): HTMLCanvasElement {
  const S = SPRITE * R
  const c = canvasOf(S * dpr, S * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const m = S / 2
  const r = rng(101 + v * 31)
  if (specOnly) {
    const k = 0.85 + r() * 0.25
    const cx = m - 0.36 * R + (r() - 0.5) * 0.1 * R
    const cy = m - 0.42 * R + (r() - 0.5) * 0.1 * R
    crescent(g, cx, cy, R, k)
    return c
  }
  // 1. contact shadow on the kraft
  const ox = m + 0.05 * R
  const oy = m + 0.07 * R
  const sh = g.createRadialGradient(ox, oy, 0.75 * R, ox, oy, 1.14 * R)
  sh.addColorStop(0, 'rgba(70,50,25,0)')
  sh.addColorStop(0.7, 'rgba(70,50,25,0.28)')
  sh.addColorStop(1, 'rgba(70,50,25,0)')
  g.fillStyle = sh
  g.beginPath()
  g.arc(ox, oy, 1.14 * R, 0, TAU)
  g.fill()
  // 2. dome body: clear plastic. The centre lets the kraft through; the edge reflects more (Fresnel),
  // and the lower-right inside edge darkens where the lens bends the shadowed kraft into view.
  const body = g.createRadialGradient(m - 0.12 * R, m - 0.15 * R, 0, m, m, R)
  body.addColorStop(0, 'rgba(255,255,255,0.16)')
  body.addColorStop(0.62, 'rgba(255,255,255,0.06)')
  body.addColorStop(0.86, 'rgba(255,255,255,0.14)')
  body.addColorStop(0.97, 'rgba(255,255,255,0.34)')
  body.addColorStop(1, 'rgba(255,255,255,0.22)')
  g.fillStyle = body
  g.beginPath()
  g.arc(m, m, R, 0, TAU)
  g.fill()
  // refraction band: lower-right inner crescent
  g.save()
  g.beginPath()
  g.arc(m, m, R * 0.97, 0, TAU)
  g.clip()
  const rf = g.createRadialGradient(m - 0.2 * R, m - 0.24 * R, 0.62 * R, m - 0.2 * R, m - 0.24 * R, 1.25 * R)
  rf.addColorStop(0, 'rgba(95,70,40,0)')
  rf.addColorStop(0.55, 'rgba(95,70,40,0.16)')
  rf.addColorStop(1, 'rgba(95,70,40,0.05)')
  g.fillStyle = rf
  g.fillRect(m - R, m - R, 2 * R, 2 * R)
  // upper-left sky reflection: a broad soft band just inside the rim
  const sk = g.createRadialGradient(m + 0.3 * R, m + 0.36 * R, 0.9 * R, m + 0.3 * R, m + 0.36 * R, 1.45 * R)
  sk.addColorStop(0, 'rgba(255,255,255,0)')
  sk.addColorStop(1, 'rgba(255,255,255,0.32)')
  g.fillStyle = sk
  g.fillRect(m - R, m - R, 2 * R, 2 * R)
  g.restore()
  // 3. rim: lit upper-left arc, dark opposite arc
  const d2r = Math.PI / 180
  // each arc fades in and out at its ends, so there is no hard outline and no end ticks
  const fadeArc = (from: number, to: number, rgb: string, peak: number) => {
    const n = 24
    g.lineWidth = 1.25
    g.lineCap = 'butt'
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n
      g.strokeStyle = `rgba(${rgb},${peak * Math.sin(u * Math.PI)})`
      g.beginPath()
      g.arc(m, m, R - 0.8, (from + ((to - from) * i) / n) * d2r, (from + ((to - from) * (i + 1)) / n + 0.3) * d2r)
      g.stroke()
    }
  }
  fadeArc(170, 350, '255,255,255', 0.6)
  fadeArc(0, 160, '60,40,20', 0.25)
  // 4. specular crescent + bounce light
  const k = 0.85 + r() * 0.25
  const cx = m - 0.36 * R + (r() - 0.5) * 0.1 * R
  const cy = m - 0.42 * R + (r() - 0.5) * 0.1 * R
  crescent(g, cx, cy, R, k)
  const bl = g.createRadialGradient(m + 0.42 * R, m + 0.4 * R, 0, m + 0.42 * R, m + 0.4 * R, 0.09 * R)
  bl.addColorStop(0, 'rgba(255,255,255,0.3)')
  bl.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = bl
  g.beginPath()
  g.arc(m + 0.42 * R, m + 0.4 * R, 0.09 * R, 0, TAU)
  g.fill()
  return c
}

/** Popped cell: a flat, slightly sunken disc of crumpled film. Drawn rotated by a per-cell angle,
 *  so the light pair is baked lit from the upper left for rotation 0 and only drifts a little with rotation. */
export function makePopped(R: number, dpr: number, v: number): HTMLCanvasElement {
  const S = SPRITE * R
  const c = canvasOf(S * dpr, S * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const m = S / 2
  const r = rng(907 + v * 53)
  const rim = 0.95 * R
  // flat disc, a touch hazier than the web around it
  g.fillStyle = 'rgba(255,255,255,0.07)'
  g.beginPath()
  g.arc(m, m, rim, 0, TAU)
  g.fill()
  g.save()
  g.beginPath()
  g.arc(m, m, rim, 0, TAU)
  g.clip()
  // sunken: a faint shadow just inside the seal (the film sits below the flat web)
  const sk = g.createRadialGradient(m, m, rim * 0.72, m, m, rim)
  sk.addColorStop(0, 'rgba(80,58,30,0)')
  sk.addColorStop(1, 'rgba(80,58,30,0.14)')
  g.fillStyle = sk
  g.fillRect(m - R, m - R, 2 * R, 2 * R)
  // the slit sits off centre; everything else gathers towards it
  const sa = r() * TAU
  const sd = (0.18 + r() * 0.22) * R
  const px = m + Math.cos(sa) * sd
  const py = m + Math.sin(sa) * sd
  // one irregular crumpled sheen patch: soft light lobe with a dark twin beside it
  const ta = sa + Math.PI + (r() - 0.5) * 1.2
  const lx = m + Math.cos(ta) * 0.3 * R
  const ly = m + Math.sin(ta) * 0.3 * R
  const blob = (x: number, y: number, rx: number, ry: number, rot: number, col: string) => {
    g.save()
    g.translate(x, y)
    g.rotate(rot)
    g.scale(rx, ry)
    const bg = g.createRadialGradient(0, 0, 0, 0, 0, 1)
    bg.addColorStop(0, col)
    bg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = bg
    g.beginPath()
    g.arc(0, 0, 1, 0, TAU)
    g.fill()
    g.restore()
  }
  const rot = r() * Math.PI
  blob(lx, ly, 0.42 * R, 0.2 * R, rot, 'rgba(255,255,255,0.13)')
  blob(lx + Math.cos(rot + 1.57) * 0.2 * R, ly + Math.sin(rot + 1.57) * 0.2 * R, 0.36 * R, 0.13 * R, rot + 0.15, 'rgba(85,60,30,0.06)')
  blob(lx + Math.cos(rot) * 0.32 * R, ly + Math.sin(rot) * 0.32 * R, 0.18 * R, 0.1 * R, rot - 0.4, 'rgba(255,255,255,0.08)')
  // 1-2 short soft creases running out from the slit (barely there on the 4 variants with no slit,
  // so those cells read as clean flat film)
  const noTear = [0, 3, 6, 8].includes(v % 10)
  const ck = noTear ? 0.4 : 1
  g.lineCap = 'round'
  const nc = 1 + (r() < 0.5 ? 1 : 0)
  for (let i = 0; i < nc; i++) {
    const a = sa + Math.PI * (0.35 + r() * 0.5) * (i ? -1 : 1)
    const L = (0.28 + r() * 0.18) * R
    const ex = px + Math.cos(a) * L
    const ey = py + Math.sin(a) * L
    const bx = (px + ex) / 2 + Math.cos(a + 1.57) * 0.06 * R
    const by = (py + ey) / 2 + Math.sin(a + 1.57) * 0.06 * R
    for (const [dx, dy, col, lw] of [
      [0.8, 0.8, `rgba(70,50,25,${0.09 * ck})`, 1.6],
      [0, 0, `rgba(255,255,255,${0.2 * ck})`, 1.4],
    ] as const) {
      g.strokeStyle = col
      g.lineWidth = lw
      g.beginPath()
      g.moveTo(px + dx, py + dy)
      g.quadraticCurveTo(bx + dx, by + dy, ex + dx, ey + dy)
      g.stroke()
    }
  }
  // the tear: a short slit with a lifted lip catching the light on its upper-left edge. Real popped
  // wrap mostly splits along the seam where you cannot see it, so 4 of the 10 variants show no tear
  // at all, and the rest vary in length, bend and depth: a uniform dark dash per cell reads as a print.
  const ang = sa + 1.57 + (r() - 0.5) * 0.9
  const sl = (0.06 + r() * 0.12) * R
  const ux = Math.cos(ang)
  const uy = Math.sin(ang)
  const bend = (r() - 0.5) * 0.12 * R
  const depth = 0.55 + r() * 0.45
  const tear = (ox: number, oy: number, col: string, lw: number) => {
    g.strokeStyle = col
    g.lineWidth = lw
    g.beginPath()
    g.moveTo(px - ux * sl + ox, py - uy * sl + oy)
    g.quadraticCurveTo(px - uy * bend + ox, py + ux * bend + oy, px + ux * sl + ox, py + uy * sl + oy)
    g.stroke()
  }
  if (!noTear) {
    tear(0, 0, `rgba(55,38,18,${(0.24 * depth).toFixed(3)})`, 1.2 + 0.3 * depth)
    tear(-0.9, -1.1, `rgba(255,255,255,${(0.28 * depth).toFixed(3)})`, 0.9)
  }
  g.restore()
  // the seal ring stays: smooth, slightly irregular
  g.strokeStyle = 'rgba(255,255,255,0.28)'
  g.lineWidth = 1
  g.beginPath()
  const segs = 96
  const ph = [r() * TAU, r() * TAU]
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * TAU
    const rr = R * (0.96 + 0.015 * Math.sin(a * 3 + ph[0]) + 0.012 * Math.sin(a * 5 + ph[1]))
    const x = m + Math.cos(a) * rr
    const y = m + Math.sin(a) * rr
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.stroke()
  return c
}
