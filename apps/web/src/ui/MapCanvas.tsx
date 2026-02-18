import type { RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentId, AgentState, DayPhase, LocationId, LocationNode, Weather, WorldState } from './types'
import { useElementSize } from './useElementSize'

type Marker = { id: string; kind: 'agent' | 'location'; x: number; y: number; r: number }

/* ═══════ Particle System ═══════ */
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; type: 'rain' | 'splash' | 'lightning' | 'fog' | 'ember' | 'sparkle' }

function createParticles(weather: Weather, w: number, h: number, tick: number): Particle[] {
  const p: Particle[] = []
  if (weather === 'rain') {
    for (let i = 0; i < 80; i++) {
      p.push({ x: Math.random() * w * 1.2 - w * 0.1, y: Math.random() * h * -0.3, vx: -1.5 - Math.random(), vy: 8 + Math.random() * 6, life: 0, maxLife: 40 + Math.random() * 30, size: 1 + Math.random() * 1.5, type: 'rain' })
    }
  }
  if (weather === 'storm') {
    for (let i = 0; i < 130; i++) {
      p.push({ x: Math.random() * w * 1.4 - w * 0.2, y: Math.random() * h * -0.4, vx: -3 - Math.random() * 2, vy: 10 + Math.random() * 8, life: 0, maxLife: 35 + Math.random() * 25, size: 1.5 + Math.random() * 2, type: 'rain' })
    }
    if (tick % 17 === 0) {
      const lx = Math.random() * w * 0.6 + w * 0.2
      p.push({ x: lx, y: 0, vx: 0, vy: h, life: 0, maxLife: 8, size: 3, type: 'lightning' })
    }
  }
  if (weather === 'fog') {
    for (let i = 0; i < 12; i++) {
      p.push({ x: Math.random() * w, y: h * 0.3 + Math.random() * h * 0.5, vx: 0.3 + Math.random() * 0.5, vy: Math.random() * 0.2 - 0.1, life: 0, maxLife: 120 + Math.random() * 80, size: 60 + Math.random() * 100, type: 'fog' })
    }
  }
  return p
}

export function MapCanvas(props: {
  state: WorldState
  selectedAgentId: AgentId | null
  selectedLocationId: LocationId | null
  onPickAgent: (id: AgentId | null) => void
  onPickLocation: (id: LocationId | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const size = useElementSize(wrapRef)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const markersRef = useRef<Marker[]>([])
  const bgRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)
  const prevPosRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const particlesRef = useRef<Particle[]>([])
  const frameRef = useRef<number>(0)
  const lastWeatherRef = useRef<string>('')

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

  const nodesById = useMemo(() => new Map(props.state.world.nodes.map((n) => [n.id, n])), [props.state.world.nodes])

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom(z => Math.max(0.5, Math.min(4, z * (e.deltaY < 0 ? 1.12 : 0.89)))) }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // Mouse drag + click
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDown = (e: MouseEvent) => { if (e.button === 0) dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y } }
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return
      const dx = e.clientX - d.startX, dy = e.clientY - d.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setPan({ x: d.panX + dx, y: d.panY + dy })
    }
    const onUp = (e: MouseEvent) => {
      const d = dragRef.current; dragRef.current = null; if (!d) return
      if (Math.abs(e.clientX - d.startX) < 4 && Math.abs(e.clientY - d.startY) < 4) {
        const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left; const my = e.clientY - rect.top
        let best: Marker | null = null; let bestD = Infinity
        for (const m of markersRef.current) { const dd = (m.x - mx) ** 2 + (m.y - my) ** 2; if (dd <= (m.r + 8) ** 2 && dd < bestD) { bestD = dd; best = m } }
        if (best) { if (best.kind === 'agent') { props.onPickAgent(best.id); props.onPickLocation(null) } else { props.onPickLocation(best.id); props.onPickAgent(null) } }
        else { props.onPickAgent(null); props.onPickLocation(null) }
      }
    }
    canvas.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { canvas.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [pan, props])

  // Spawn particles on weather change
  useEffect(() => {
    const w = props.state.weather
    if (w !== lastWeatherRef.current) {
      lastWeatherRef.current = w
      particlesRef.current = createParticles(w, size.w, size.h, props.state.tick)
    }
  }, [props.state.weather, size.w, size.h, props.state.tick])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let running = true
    const animate = () => {
      if (!running) return
      frameRef.current++
      const w = Math.max(1, size.w), h = Math.max(1, size.h)
      canvas.width = Math.floor(w * devicePixelRatio)
      canvas.height = Math.floor(h * devicePixelRatio)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      draw(ctx, w, h, props.state, props.selectedAgentId, props.selectedLocationId, nodesById, bgRef, markersRef, prevPosRef, zoom, pan, particlesRef.current, frameRef.current)
      updateParticles(particlesRef.current, w, h, props.state.weather, props.state.tick)
      requestAnimationFrame(animate)
    }
    animate()
    return () => { running = false }
  }, [size.w, size.h, props.state, props.selectedAgentId, props.selectedLocationId, nodesById, zoom, pan])

  return (
    <div className="w-full h-full relative overflow-hidden" ref={wrapRef}>
      <canvas ref={canvasRef} className="cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-20 right-4 flex flex-col gap-1 z-10">
        <button onClick={() => setZoom(z => Math.min(4, z * 1.3))} className="w-8 h-8 rounded-lg bg-black/60 text-white/80 hover:text-white hover:bg-black/80 text-lg font-bold backdrop-blur transition-all border border-white/10">+</button>
        <button onClick={() => setZoom(z => Math.max(0.5, z * 0.77))} className="w-8 h-8 rounded-lg bg-black/60 text-white/80 hover:text-white hover:bg-black/80 text-lg font-bold backdrop-blur transition-all border border-white/10">−</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="w-8 h-8 rounded-lg bg-black/60 text-white/60 hover:text-white hover:bg-black/80 text-xs font-bold backdrop-blur transition-all border border-white/10">⟲</button>
      </div>
    </div>
  )
}

/* ═══════ Particle Update ═══════ */
function updateParticles(particles: Particle[], w: number, h: number, weather: Weather, tick: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!
    p.life++
    p.x += p.vx
    p.y += p.vy
    if (p.life >= p.maxLife || p.y > h + 20 || p.x < -50 || p.x > w + 50) {
      if (p.type === 'rain' && (weather === 'rain' || weather === 'storm')) {
        // Respawn rain drop
        p.x = Math.random() * w * 1.3 - w * 0.15
        p.y = -10 - Math.random() * 50
        p.life = 0
        // Create splash
        if (Math.random() < 0.3) {
          particles.push({ x: p.x + p.vx * 3, y: h * (0.8 + Math.random() * 0.2), vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random() * 2, life: 0, maxLife: 8, size: 1.5, type: 'splash' })
        }
      } else if (p.type === 'fog') {
        p.x = -p.size
        p.life = 0
      } else {
        particles.splice(i, 1)
      }
    }
  }
  // Storm: occasional new lightning
  if (weather === 'storm' && tick % 11 === 0 && Math.random() < 0.4) {
    particles.push({ x: Math.random() * w * 0.6 + w * 0.2, y: 0, vx: 0, vy: h, life: 0, maxLife: 6, size: 3, type: 'lightning' })
  }
}

/* ═══════ DRAW ═══════ */
function draw(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  state: WorldState, selectedAgentId: AgentId | null, selectedLocationId: LocationId | null,
  nodesById: Map<string, LocationNode>,
  bgRef: RefObject<{ key: string; canvas: HTMLCanvasElement } | null>,
  markersRef: RefObject<Marker[]>,
  prevPosRef: RefObject<Map<string, { x: number; y: number }>>,
  zoom: number, pan: { x: number; y: number },
  particles: Particle[], frame: number,
) {
  ctx.clearRect(0, 0, w, h)
  const worldW = state.world.width, worldH = state.world.height
  const baseScale = Math.max(0.01, Math.min(w / worldW, h / worldH)) * 0.88
  const scale = baseScale * zoom
  const offX = (w - worldW * scale) / 2 + pan.x
  const offY = (h - worldH * scale) / 2 + pan.y

  // Ocean
  const oGrd = ctx.createLinearGradient(0, 0, 0, h)
  oGrd.addColorStop(0, '#0a1628')
  oGrd.addColorStop(0.5, '#0d2137')
  oGrd.addColorStop(1, '#061220')
  ctx.fillStyle = oGrd
  ctx.fillRect(0, 0, w, h)

  // Animated ocean waves
  ctx.save()
  ctx.globalAlpha = 0.04
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.strokeStyle = '#00bcd4'
    ctx.lineWidth = 1
    for (let x = 0; x < w; x += 3) {
      const y = h * 0.3 + i * 50 + Math.sin(x * 0.01 + frame * 0.03 + i * 2) * 15
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()

  // Tech grid
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.025)'
  ctx.lineWidth = 0.5
  const gs = 40 * zoom
  for (let gx = (offX % gs); gx < w; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke() }
  for (let gy = (offY % gs); gy < h; gy += gs) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke() }
  ctx.restore()

  // Island terrain
  const bgKey = `${state.world.seed}:${worldW}:${worldH}:v3`
  const cached = bgRef.current
  let bg = cached?.key === bgKey ? cached.canvas : null
  if (!bg) { bg = buildIslandTerrain(state.world.seed, 500, 350); bgRef.current = { key: bgKey, canvas: bg } }
  ctx.drawImage(bg, offX, offY, worldW * scale, worldH * scale)

  // Paths
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 220, 255, 0.12)'
  ctx.lineWidth = 1.5 * zoom
  ctx.setLineDash([6 * zoom, 5 * zoom])
  for (const edge of state.world.edges) {
    const a = nodesById.get(edge.a), b = nodesById.get(edge.b)
    if (!a || !b) continue
    ctx.beginPath(); ctx.moveTo(offX + a.x * scale, offY + a.y * scale); ctx.lineTo(offX + b.x * scale, offY + b.y * scale); ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()

  // Group agents
  markersRef.current = []
  const grouped = new Map<string, AgentState[]>()
  for (const a of state.agents) { if (!a.isAlive) continue; const arr = grouped.get(a.locationId) ?? []; arr.push(a); grouped.set(a.locationId, arr) }

  // Nodes
  for (const n of state.world.nodes) {
    const x = offX + n.x * scale, y = offY + n.y * scale
    const isSelected = n.id === selectedLocationId
    const agentsHere = grouped.get(n.id) ?? []
    const nodeR = 14 * zoom

    // Pulse for selected
    if (isSelected) {
      ctx.save()
      const pulseR = nodeR + 8 * zoom + Math.sin(frame * 0.08) * 3 * zoom
      ctx.strokeStyle = '#00e5ff'
      ctx.lineWidth = 2 * zoom
      ctx.globalAlpha = 0.4 + Math.sin(frame * 0.08) * 0.2
      ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 20 * zoom
      ctx.beginPath(); ctx.arc(x, y, pulseR, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }

    // Shelter ring
    if (n.shelter) {
      ctx.save(); ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)'; ctx.lineWidth = 1.5 * zoom; ctx.setLineDash([3 * zoom, 3 * zoom])
      ctx.beginPath(); ctx.arc(x, y, nodeR + 4 * zoom, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore()
    }

    // Activity glow
    if (agentsHere.length > 0) {
      ctx.save(); const grd = ctx.createRadialGradient(x, y, 0, x, y, nodeR * 2.5)
      grd.addColorStop(0, 'rgba(255, 200, 50, 0.15)'); grd.addColorStop(1, 'rgba(255, 200, 50, 0)')
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, nodeR * 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }

    // Node circle
    ctx.save()
    ctx.beginPath(); ctx.fillStyle = 'rgba(10, 20, 35, 0.88)'; ctx.arc(x, y, nodeR, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.strokeStyle = isSelected ? '#00e5ff' : kindAccent(n.kind); ctx.lineWidth = 2 * zoom; ctx.arc(x, y, nodeR, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()

    // Building icon
    ctx.font = `${14 * zoom}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(kindBuilding(n.kind), x, y)

    // Name
    ctx.save(); ctx.font = `bold ${Math.max(8, 10 * zoom)}px "Inter", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(200, 230, 255, 0.9)'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4
    ctx.fillText(n.name, x, y + nodeR + 3 * zoom); ctx.restore()

    // Resource badge
    const totalRes = Object.values(n.resources).reduce((s, v) => s + v, 0)
    if (totalRes > 0) {
      ctx.font = `bold ${Math.max(7, 9 * zoom)}px "Inter", sans-serif`
      const badge = `${totalRes}`; const tw = ctx.measureText(badge).width
      ctx.fillStyle = 'rgba(0, 200, 150, 0.8)'; ctx.beginPath(); ctx.roundRect(x + nodeR + 1, y - 7 * zoom, tw + 8 * zoom, 13 * zoom, 4 * zoom); ctx.fill()
      ctx.fillStyle = '#000'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(badge, x + nodeR + 4 * zoom, y)
    }

    markersRef.current.push({ id: n.id, kind: 'location', x, y, r: nodeR + 2 })

    // Agents around location
    if (agentsHere.length) {
      const ring = (nodeR + 18) * zoom
      for (let i = 0; i < agentsHere.length; i++) {
        const a = agentsHere[i]!
        const ang = (i / agentsHere.length) * Math.PI * 2 - Math.PI / 2
        // Gentle floating animation
        const floatY = Math.sin(frame * 0.04 + i * 1.7) * 2 * zoom
        const ax = x + Math.cos(ang) * ring
        const ay = y + Math.sin(ang) * ring + floatY
        const ar = 12 * zoom

        // Trail
        const prev = prevPosRef.current.get(a.id)
        if (prev && (Math.abs(prev.x - ax) > 5 || Math.abs(prev.y - ay) > 5)) {
          ctx.save(); ctx.beginPath(); ctx.strokeStyle = 'rgba(0, 220, 255, 0.08)'; ctx.lineWidth = 1
          ctx.moveTo(prev.x, prev.y); ctx.lineTo(ax, ay); ctx.stroke(); ctx.restore()
        }
        prevPosRef.current.set(a.id, { x: ax, y: ay })

        // Agent body glow
        ctx.save(); ctx.shadowColor = agentGlow(a); ctx.shadowBlur = (a.id === selectedAgentId ? 18 : 10) * zoom
        ctx.beginPath(); ctx.fillStyle = agentColor(a); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill(); ctx.restore()

        // Border
        ctx.beginPath()
        ctx.strokeStyle = a.id === selectedAgentId ? '#00e5ff' : 'rgba(200,220,255,0.35)'
        ctx.lineWidth = a.id === selectedAgentId ? 2.5 * zoom : 1.5 * zoom
        ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke()

        // Selection ring (animated)
        if (a.id === selectedAgentId) {
          const selR = ar + 5 * zoom + Math.sin(frame * 0.1) * 1.5 * zoom
          ctx.save(); ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 1.5 * zoom; ctx.globalAlpha = 0.6
          ctx.setLineDash([4 * zoom, 3 * zoom])
          ctx.beginPath(); ctx.arc(ax, ay, selR, 0, Math.PI * 2); ctx.stroke()
          ctx.setLineDash([]); ctx.restore()
        }

        // Emoji
        ctx.font = `${13 * zoom}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(a.emoji, ax, ay)

        // Health bar
        const barW = 24 * zoom, barH = 3 * zoom, barX = ax - barW / 2, barY = ay - ar - 7 * zoom
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, barY, barW, barH)
        const hpGrd = ctx.createLinearGradient(barX, 0, barX + barW * a.health / 100, 0)
        hpGrd.addColorStop(0, healthColor(a.health)); hpGrd.addColorStop(1, healthColorEnd(a.health))
        ctx.fillStyle = hpGrd; ctx.fillRect(barX, barY, barW * (a.health / 100), barH)

        // Hunger bar
        const hBarY = barY + barH + 1
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, hBarY, barW, barH)
        ctx.fillStyle = hungerColor(a.hunger); ctx.fillRect(barX, hBarY, barW * (a.hunger / 100), barH)

        // Name
        ctx.save(); ctx.font = `bold ${Math.max(7, 9 * zoom)}px "Inter", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillStyle = '#e0f0ff'; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3
        ctx.fillText(a.name, ax, ay + ar + 2 * zoom); ctx.restore()

        // Low health warning
        if (a.health < 25) {
          ctx.save(); ctx.font = `${8 * zoom}px serif`; ctx.fillStyle = '#ef4444'; ctx.globalAlpha = 0.5 + Math.sin(frame * 0.15) * 0.5
          ctx.textAlign = 'center'; ctx.fillText('⚠️', ax + ar + 3 * zoom, ay - ar); ctx.restore()
        }

        markersRef.current.push({ id: a.id, kind: 'agent', x: ax, y: ay, r: ar + 4 })

        // ★ THOUGHT BUBBLE
        if (a.lastThought && a.lastThought.length > 0) {
          const thought = a.lastThought.length > 25 ? a.lastThought.slice(0, 23) + '…' : a.lastThought
          ctx.save()
          ctx.font = `${Math.max(7, 8 * zoom)}px "Inter", sans-serif`
          const tw = ctx.measureText(thought).width
          const bx = ax - tw / 2 - 6 * zoom
          const by = ay - ar - 22 * zoom
          const bw = tw + 12 * zoom
          const bh = 14 * zoom
          // Animated opacity
          ctx.globalAlpha = 0.6 + Math.sin(frame * 0.05 + i * 2) * 0.15
          // Background pill
          ctx.fillStyle = 'rgba(10, 15, 30, 0.85)'
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6 * zoom); ctx.fill()
          ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)'; ctx.lineWidth = 0.5 * zoom
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6 * zoom); ctx.stroke()
          // Small triangle pointer
          ctx.fillStyle = 'rgba(10, 15, 30, 0.85)'
          ctx.beginPath(); ctx.moveTo(ax - 3 * zoom, by + bh); ctx.lineTo(ax + 3 * zoom, by + bh); ctx.lineTo(ax, by + bh + 4 * zoom); ctx.fill()
          // Text
          ctx.fillStyle = '#b0e0ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(thought, ax, by + bh / 2)
          ctx.restore()
        }
      }
    }
  }

  // ★ RELATIONSHIP LINES between agents in the same location
  const relState = state as WorldState & { relations?: Array<{ a: string; b: string; affinity: number; trust: number }> }
  if (relState.relations) {
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 1.2 * zoom
    for (const rel of relState.relations) {
      if (Math.abs(rel.affinity) < 0.2) continue // skip neutral
      const agA = state.agents.find(x => x.id === rel.a && x.isAlive)
      const agB = state.agents.find(x => x.id === rel.b && x.isAlive)
      if (!agA || !agB) continue
      // Only draw if in same or nearby locations
      if (agA.locationId !== agB.locationId) continue
      const mA = markersRef.current.find(m => m.id === rel.a)
      const mB = markersRef.current.find(m => m.id === rel.b)
      if (!mA || !mB) continue
      ctx.beginPath()
      if (rel.affinity > 0.2) {
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.3 + rel.affinity * 0.5})`
        ctx.setLineDash([4 * zoom, 4 * zoom])
      } else {
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + Math.abs(rel.affinity) * 0.5})`
        ctx.setLineDash([2 * zoom, 3 * zoom])
      }
      ctx.moveTo(mA.x, mA.y); ctx.lineTo(mB.x, mB.y); ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.restore()
  }

  // ★ DEAD AGENTS — show skull markers where they died
  for (const a of state.agents) {
    if (a.isAlive) continue
    const loc = nodesById.get(a.locationId)
    if (!loc) continue
    const x = offX + loc.x * scale + (a.id.charCodeAt(0) % 30 - 15) * zoom
    const y = offY + loc.y * scale + (a.id.charCodeAt(1) % 30 - 15) * zoom
    ctx.save()
    ctx.globalAlpha = 0.4 + Math.sin(frame * 0.03) * 0.1
    ctx.font = `${12 * zoom}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('💀', x, y)
    ctx.font = `bold ${Math.max(6, 7 * zoom)}px "Inter", sans-serif`
    ctx.fillStyle = '#ef4444'; ctx.fillText(a.name, x, y + 10 * zoom)
    ctx.restore()
  }

  // Day/Night overlay
  drawDayNight(ctx, w, h, state.dayPhase, frame)

  // ★ Weather particles
  drawParticles(ctx, particles, w, h, frame, state.weather)

  // HUD
  drawHUD(ctx, w, h, state)
}

/* ═══════ PARTICLES RENDER ═══════ */
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], w: number, h: number, frame: number, weather: Weather) {
  ctx.save()
  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.life / p.maxLife)

    if (p.type === 'rain') {
      ctx.beginPath()
      ctx.strokeStyle = weather === 'storm' ? `rgba(120, 180, 255, ${alpha * 0.55})` : `rgba(100, 170, 255, ${alpha * 0.35})`
      ctx.lineWidth = p.size * 0.7
      const len = weather === 'storm' ? 18 : 12
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 1.5, p.y + len); ctx.stroke()
    }

    if (p.type === 'splash') {
      ctx.beginPath()
      ctx.fillStyle = `rgba(150, 200, 255, ${alpha * 0.5})`
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2); ctx.fill()
    }

    if (p.type === 'lightning') {
      const progress = p.life / p.maxLife
      if (progress < 0.3) {
        // Draw lightning bolt
        ctx.save()
        ctx.strokeStyle = `rgba(200, 230, 255, ${(1 - progress * 3) * 0.9})`
        ctx.lineWidth = p.size
        ctx.shadowColor = '#88ccff'; ctx.shadowBlur = 30
        ctx.beginPath()
        let lx = p.x, ly = 0
        const segs = 6 + Math.floor(Math.random() * 4)
        ctx.moveTo(lx, ly)
        for (let s = 0; s < segs; s++) {
          ly += p.vy / segs
          lx += (Math.random() - 0.5) * 60
          ctx.lineTo(lx, ly)
        }
        ctx.stroke()
        ctx.restore()

        // Flash effect
        ctx.save()
        ctx.fillStyle = `rgba(200, 230, 255, ${(1 - progress * 3) * 0.06})`
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
      }
    }

    if (p.type === 'fog') {
      ctx.save()
      ctx.globalAlpha = alpha * 0.12
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
      grd.addColorStop(0, 'rgba(180, 200, 220, 0.3)')
      grd.addColorStop(0.5, 'rgba(150, 170, 200, 0.15)')
      grd.addColorStop(1, 'rgba(150, 170, 200, 0)')
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }
  }

  // Storm screen flash (rare)
  if (weather === 'storm' && frame % 120 < 3) {
    ctx.save(); ctx.fillStyle = 'rgba(200, 230, 255, 0.03)'; ctx.fillRect(0, 0, w, h); ctx.restore()
  }

  ctx.restore()
}

/* ═══════ Day/Night ═══════ */
function drawDayNight(ctx: CanvasRenderingContext2D, w: number, h: number, phase: DayPhase, frame: number) {
  if (phase === 'day') return
  ctx.save()
  if (phase === 'dawn') {
    const grd = ctx.createLinearGradient(0, 0, w, h * 0.3)
    grd.addColorStop(0, 'rgba(255, 160, 60, 0.08)')
    grd.addColorStop(1, 'rgba(255, 100, 40, 0.03)')
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h)
  } else if (phase === 'dusk') {
    const grd = ctx.createLinearGradient(w, 0, 0, h)
    grd.addColorStop(0, 'rgba(200, 80, 30, 0.12)')
    grd.addColorStop(1, 'rgba(100, 30, 60, 0.06)')
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h)
  } else if (phase === 'night') {
    // Dark overlay
    ctx.fillStyle = 'rgba(2, 5, 20, 0.35)'; ctx.fillRect(0, 0, w, h)
    // Stars with twinkle
    const rnd = mulberry32Simple(42)
    for (let i = 0; i < 40; i++) {
      const sx = rnd() * w, sy = rnd() * h * 0.6
      const twinkle = 0.3 + Math.sin(frame * 0.02 + i * 7.3) * 0.3
      ctx.fillStyle = `rgba(180, 220, 255, ${twinkle})`
      ctx.beginPath(); ctx.arc(sx, sy, 0.6 + rnd() * 0.8, 0, Math.PI * 2); ctx.fill()
    }
    // Moon
    ctx.save()
    ctx.fillStyle = 'rgba(230, 240, 255, 0.15)'
    ctx.shadowColor = 'rgba(200, 220, 255, 0.3)'; ctx.shadowBlur = 30
    ctx.beginPath(); ctx.arc(w * 0.85, h * 0.12, 18, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/* ═══════ HUD ═══════ */
function drawHUD(ctx: CanvasRenderingContext2D, w: number, h: number, state: WorldState) {
  const pe: Record<DayPhase, string> = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' }
  const we: Record<Weather, string> = { clear: '☀️', rain: '🌧️', storm: '⛈️', fog: '🌫️' }
  const hud = `${pe[state.dayPhase]} День ${state.day}  ${we[state.weather]}`
  const alive = state.agents.filter(a => a.isAlive).length

  ctx.save()
  ctx.font = 'bold 13px "Inter", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  const tm = ctx.measureText(hud)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; ctx.beginPath(); ctx.roundRect(10, 10, tm.width + 24, 30, 8); ctx.fill()
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.25)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = '#c0e8ff'; ctx.fillText(hud, 22, 17)
  ctx.restore()

  ctx.save()
  const as = `👥 ${alive}/5`
  ctx.font = 'bold 12px "Inter", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'
  const atm = ctx.measureText(as)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; ctx.beginPath(); ctx.roundRect(w - atm.width - 32, 10, atm.width + 24, 30, 8); ctx.fill()
  ctx.strokeStyle = alive >= 3 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'; ctx.lineWidth = 1; ctx.stroke()
  ctx.fillStyle = alive >= 3 ? '#4ade80' : '#ef4444'; ctx.fillText(as, w - 20, 17)
  ctx.restore()
}

/* ═══════ HELPERS ═══════ */
function mulberry32Simple(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 } }

function buildIslandTerrain(seed: number, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w, ny = y / h
      const d = Math.hypot(nx - 0.5, ny - 0.5) * 2.2
      const mask = clamp01(1.0 - Math.pow(d, 2.0))
      const e = fbm(seed, nx * 5, ny * 5), m = fbm(seed + 77, nx * 10 + 2, ny * 10 - 0.4)
      const v = clamp01((e * 0.6 + m * 0.4) * mask)
      const [r, g, b] = islandColor(v)
      const i = (y * w + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  // Scanlines
  ctx.fillStyle = 'rgba(0, 200, 255, 0.012)'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  // Vignette
  const grd = ctx.createRadialGradient(w / 2, h / 2, w / 3.5, w / 2, h / 2, w / 1.2)
  grd.addColorStop(0, 'rgba(10, 30, 60, 0)'); grd.addColorStop(1, 'rgba(5, 15, 30, 0.5)')
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h)
  return c
}
function islandColor(v: number): [number, number, number] {
  if (v < 0.32) return [10, 30, 55]; if (v < 0.38) return [15, 50, 80]; if (v < 0.42) return [180, 170, 130]
  if (v < 0.55) return [35, 110, 45]; if (v < 0.68) return [25, 85, 30]; if (v < 0.78) return [70, 65, 55]
  if (v < 0.88) return [95, 90, 80]; return [160, 155, 150]
}
function fbm(seed: number, x: number, y: number) { let v = 0, amp = 0.6, freq = 1; for (let i = 0; i < 5; i++) { v += amp * valueNoise(seed + i * 101, x * freq, y * freq); freq *= 2; amp *= 0.5 }; return v }
function valueNoise(seed: number, x: number, y: number) { const x0 = Math.floor(x), y0 = Math.floor(y); const sx = smoothstep(x - x0), sy = smoothstep(y - y0); return lerp(lerp(hash2(seed, x0, y0), hash2(seed, x0 + 1, y0), sx), lerp(hash2(seed, x0, y0 + 1), hash2(seed, x0 + 1, y0 + 1), sx), sy) }
function hash2(seed: number, x: number, y: number) { let h = seed ^ (x * 374761393) ^ (y * 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
function smoothstep(t: number) { return t * t * (3 - 2 * t) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function clamp01(n: number) { return Math.max(0, Math.min(1, n)) }

function agentColor(a: AgentState) { if (a.health < 25) return '#dc2626'; if (a.mood.valence >= 0.4) return '#10b981'; if (a.mood.valence >= 0.1) return '#34d399'; if (a.mood.valence > -0.2) return '#3b82f6'; if (a.mood.valence > -0.5) return '#f59e0b'; return '#ef4444' }
function agentGlow(a: AgentState) { if (a.health < 25) return 'rgba(220,38,38,0.6)'; if (a.mood.valence >= 0.3) return 'rgba(16,185,129,0.5)'; if (a.mood.valence > -0.3) return 'rgba(59,130,246,0.4)'; return 'rgba(239,68,68,0.5)' }
function healthColor(hp: number) { return hp > 60 ? '#22c55e' : hp > 30 ? '#eab308' : '#ef4444' }
function healthColorEnd(hp: number) { return hp > 60 ? '#4ade80' : hp > 30 ? '#fbbf24' : '#f87171' }
function hungerColor(h: number) { return h < 40 ? '#22c55e' : h < 70 ? '#f59e0b' : '#ef4444' }
function kindAccent(kind: string) { const m: Record<string, string> = { beach: '#f0d68a', jungle: '#22c55e', mountain: '#94a3b8', cave: '#818cf8', lake: '#22d3ee', camp: '#f97316' }; return m[kind] ?? '#6b7280' }
function kindBuilding(kind: string) { const m: Record<string, string> = { beach: '🏖️', jungle: '🛖', mountain: '🏔️', cave: '⛏️', lake: '🏕️', camp: '⛺' }; return m[kind] ?? '📍' }
