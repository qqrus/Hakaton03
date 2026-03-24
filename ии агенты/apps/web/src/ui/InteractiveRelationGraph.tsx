import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { AgentId, WorldState } from './types'

export function InteractiveRelationGraph(props: {
  state: WorldState
  selectedAgentId: AgentId | null
  onPickAgent: (id: AgentId | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [dims, setDims] = useState({ w: 600, h: 400 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const e = entries[0]
      if (e) setDims({ w: e.contentRect.width, h: e.contentRect.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const graphData = useMemo(() => {
    const nodes = props.state.agents.map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      role: a.role,
      isAlive: a.isAlive,
      health: a.health,
      mood: a.mood,
      _color: a.isAlive ? moodColor(a.mood.valence) : '#4b5563',
    }))
    const links = props.state.relations.map((r) => ({
      source: r.a,
      target: r.b,
      affinity: r.affinity,
      trust: r.trust,
      color: r.affinity >= 0.3 ? '#22c55e' : r.affinity <= -0.3 ? '#ef4444' : '#6b7280',
      width: Math.max(1, Math.abs(r.affinity) * 4),
    }))
    return { nodes, links }
  }, [props.state.agents, props.state.relations])

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, _globalScale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = 8 // Уменьшенный радиус (было 12)
    const isSel = props.selectedAgentId === node.id

    // Glow
    ctx.save()
    ctx.shadowColor = node._color
    ctx.shadowBlur = isSel ? 15 : 6
    ctx.beginPath()
    ctx.fillStyle = node._color
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Border
    ctx.beginPath()
    ctx.strokeStyle = isSel ? '#ffd700' : '#1e293b'
    ctx.lineWidth = isSel ? 2 : 1
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()

    // Emoji
    ctx.font = '10px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(node.emoji, x, y)

    // Name
    ctx.font = 'bold 6px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = node.isAlive ? '#e5e7eb' : '#6b7280'
    ctx.fillText(node.name, x, y + r + 2)

    if (!node.isAlive) {
      ctx.font = 'bold 6px sans-serif'
      ctx.fillStyle = '#ef4444'
      ctx.fillText('💀', x, y - r - 4)
    }
  }, [props.selectedAgentId])

  return (
    <div ref={wrapRef} className="w-full h-full bg-ocean-900">
      <ForceGraph2D
        width={dims.w}
        height={dims.h}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.beginPath()
          ctx.fillStyle = color
          ctx.arc(node.x ?? 0, node.y ?? 0, 16, 0, Math.PI * 2)
          ctx.fill()
        }}
        onNodeClick={(node: any) => props.onPickAgent(node.id)}
        linkColor={(link: any) => link.color}
        linkWidth={(link: any) => link.width}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTime={3000}
      />
    </div>
  )
}

function moodColor(valence: number) {
  if (valence >= 0.5) return '#10b981'
  if (valence >= 0.15) return '#34d399'
  if (valence > -0.15) return '#60a5fa'
  if (valence > -0.5) return '#f59e0b'
  return '#ef4444'
}
