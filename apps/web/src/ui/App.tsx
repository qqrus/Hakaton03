import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useWorld } from './useWorld'
import type { AgentId, AgentState, DayPhase, EventEnvelope, LocationId, LocationNode, Relation, Weather, WorldState } from './types'
import { MapCanvas } from './MapCanvas'
import { ControlPanel } from './ControlPanel'

/* ═══════ TOAST SYSTEM ═══════ */
type Toast = { id: string; text: string; type: string; ts: number }

export function App() {
  const { state, connected, setSpeed, injectEvent, sendMessage, setGoal, sendChallenge } = useWorld()
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<LocationId | null>(null)
  const [mode, setMode] = useState<'map' | 'relations'>('map')
  const [toasts, setToasts] = useState<Toast[]>([])
  const prevFeedLen = useRef(0)

  // ★ Auto-toast important events
  useEffect(() => {
    if (!state) return
    const feed = state.feed
    if (feed.length > prevFeedLen.current) {
      const newItems = feed.slice(prevFeedLen.current)
      for (const e of newItems) {
        if (e.importance >= 0.6 || e.type === 'death' || e.type === 'attack' || e.type === 'weather') {
          setToasts(prev => [...prev.slice(-4), { id: e.id, text: `${e.title}: ${e.text.slice(0, 80)}`, type: e.type, ts: Date.now() }])
        }
      }
    }
    prevFeedLen.current = feed.length
  }, [state?.feed.length])

  // Auto-remove toasts
  useEffect(() => {
    if (toasts.length === 0) return
    const t = setTimeout(() => setToasts(prev => prev.filter(x => Date.now() - x.ts < 6000)), 1000)
    return () => clearTimeout(t)
  }, [toasts])

  const selectedAgent = useMemo(() => {
    if (!state || !selectedAgentId) return null
    return state.agents.find((a) => a.id === selectedAgentId) ?? null
  }, [state, selectedAgentId])

  const selectedLocation = useMemo(() => {
    if (!state || !selectedLocationId) return null
    return state.world.nodes.find((n) => n.id === selectedLocationId) ?? null
  }, [state, selectedLocationId])

  if (!state) return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #061220 100%)' }}>
      <div className="text-center">
        <div className="text-6xl mb-4" style={{ animation: 'float 3s ease-in-out infinite' }}>🏝️</div>
        <div className="text-2xl font-bold text-cyan-400" style={{ animation: 'pulse 2s ease-in-out infinite' }}>ISLAND SURVIVAL</div>
        <div className="text-sm text-gray-500 mt-2">Инициализация системы...</div>
        <div className="mt-4 w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-cyan-500 rounded-full" style={{ width: '60%', animation: 'loading 2s ease-in-out infinite' }} />
        </div>
      </div>
    </div>
  )

  const phaseEmoji: Record<DayPhase, string> = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' }
  const weatherEmoji: Record<Weather, string> = { clear: '☀️', rain: '🌧️', storm: '⛈️', fog: '🌫️' }
  const weatherRu: Record<Weather, string> = { clear: 'Ясно', rain: 'Дождь', storm: 'Шторм', fog: 'Туман' }
  const alive = state.agents.filter(a => a.isAlive).length

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ background: '#080e18' }}>

      {/* LEFT: Event Feed */}
      <div className="hidden lg:flex flex-col w-[340px] flex-shrink-0 border-r" style={{ borderColor: '#1a2a3e', background: 'linear-gradient(180deg, #0c1a2b 0%, #081420 100%)' }}>
        <div className="h-12 flex items-center px-4 gap-3 border-b" style={{ borderColor: '#1a2a3e', background: '#0a1525' }}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`} style={connected ? { boxShadow: '0 0 8px rgba(52,211,153,0.6)' } : {}} />
            <span className="font-bold text-cyan-300 text-xs tracking-wider uppercase">LIVE FEED</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-mono">TICK {state.tick}</span>
          </div>
        </div>
        <Feed feed={state.feed} agents={state.agents} onPickAgent={setSelectedAgentId} />
      </div>

      {/* CENTER: Map */}
      <div className="flex-1 h-screen relative overflow-hidden">
        {/* Top bar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-1 py-1 rounded-xl border backdrop-blur-md" style={{ background: 'rgba(8, 14, 24, 0.85)', borderColor: 'rgba(0, 200, 255, 0.15)' }}>
          <button onClick={() => setMode('map')}
            className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'map' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            style={mode === 'map' ? { background: 'linear-gradient(135deg, #0d9488, #0891b2)', boxShadow: '0 0 15px rgba(6,182,212,0.3)' } : {}}>
            🗺️ Карта
          </button>
          <button onClick={() => setMode('relations')}
            className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'relations' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            style={mode === 'relations' ? { background: 'linear-gradient(135deg, #0d9488, #0891b2)', boxShadow: '0 0 15px rgba(6,182,212,0.3)' } : {}}>
            🤝 Связи
          </button>
          <div className="mx-2 w-px h-5 bg-gray-700/50" />
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-cyan-400 text-sm">{phaseEmoji[state.dayPhase]}</span>
            <span className="font-bold text-white text-xs">День {state.day}</span>
            <WeatherBadge weather={state.weather} emoji={weatherEmoji[state.weather]} label={weatherRu[state.weather]} />
            <span className={`text-xs font-bold ml-1 ${alive >= 3 ? 'text-emerald-400' : 'text-red-400'}`}>👥 {alive}/5</span>
          </div>
        </div>

        {mode === 'map' ? (
          <MapCanvas state={state} selectedAgentId={selectedAgentId} selectedLocationId={selectedLocationId} onPickAgent={setSelectedAgentId} onPickLocation={setSelectedLocationId} />
        ) : (
          <RelationPanel state={state} selectedAgentId={selectedAgentId} onPickAgent={setSelectedAgentId} />
        )}

        {/* ★ Notification Toasts */}
        <div className="absolute top-16 right-4 z-30 flex flex-col gap-2 pointer-events-none max-w-xs">
          {toasts.map((t, i) => (
            <div key={t.id} className="animate-slide-in px-4 py-2.5 rounded-xl border backdrop-blur-md pointer-events-auto" style={{
              background: 'rgba(8, 14, 24, 0.92)', borderColor: eventColor(t.type) + '55',
              boxShadow: `0 0 20px ${eventColor(t.type)}22, inset 0 0 20px ${eventColor(t.type)}08`,
              animationDelay: `${i * 80}ms`, opacity: Math.max(0, 1 - (Date.now() - t.ts) / 6000),
            }}>
              <div className="text-[11px] text-gray-200 font-medium leading-snug">{t.text}</div>
              <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: '#1a2a3e' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, 100 - (Date.now() - t.ts) / 60)}%`, background: eventColor(t.type) }} />
              </div>
            </div>
          ))}
        </div>

        {/* Speed Control */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2.5 rounded-full border backdrop-blur-md" style={{ background: 'rgba(8, 14, 24, 0.85)', borderColor: 'rgba(0, 200, 255, 0.12)' }}>
          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">SPD</span>
          <input type="range" min={0.25} max={6} step={0.25} value={state.speed}
            onChange={(e) => setSpeed(Number(e.target.value))} className="w-28 cursor-pointer" />
          <span className="font-mono text-cyan-300 font-bold w-10 text-right text-sm">{state.speed.toFixed(1)}x</span>
        </div>
      </div>

      {/* RIGHT: Inspector + Controls */}
      <div className="hidden lg:flex flex-col w-[380px] flex-shrink-0 border-l" style={{ borderColor: '#1a2a3e', background: 'linear-gradient(180deg, #0c1a2b 0%, #081420 100%)' }}>
        <div className="h-12 flex items-center justify-between px-4 border-b" style={{ borderColor: '#1a2a3e', background: '#0a1525' }}>
          <span className="font-bold text-xs text-cyan-300 tracking-wider uppercase">📋 ДОСЬЕ</span>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <Inspector state={state} selectedAgent={selectedAgent} selectedLocation={selectedLocation} onPickAgent={setSelectedAgentId} setGoal={setGoal} sendChallenge={sendChallenge} />
          <div className="border-t p-3" style={{ borderColor: '#1a2a3e', background: '#0a1525' }}>
            <ControlPanel onInjectEvent={injectEvent} onSendMessage={sendMessage} onSetGoal={setGoal} selectedAgentId={selectedAgentId} agents={state.agents} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════ WEATHER BADGE ═══════ */
function WeatherBadge(props: { weather: Weather; emoji: string; label: string }) {
  const isStorm = props.weather === 'storm'
  const isRain = props.weather === 'rain'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 transition-all ${isStorm ? 'animate-pulse' : ''}`}
      style={{
        background: isStorm ? 'rgba(220, 38, 38, 0.15)' : isRain ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 200, 255, 0.05)',
        borderColor: isStorm ? '#dc2626' : isRain ? '#3b82f6' : '#1a2a3e',
        color: isStorm ? '#f87171' : isRain ? '#60a5fa' : '#9cb8d4',
        boxShadow: isStorm ? '0 0 12px rgba(220, 38, 38, 0.3)' : 'none',
      }}>
      <span className="text-sm">{props.emoji}</span>
      {props.label}
    </span>
  )
}

/* ═══════ FEED ═══════ */
function Feed(props: { feed: EventEnvelope[]; agents: AgentState[]; onPickAgent: (id: AgentId | null) => void }) {
  const byId = useMemo(() => new Map(props.agents.map((a) => [a.id, a])), [props.agents])
  const feedRef = useRef<HTMLDivElement>(null)
  const items = props.feed.slice(-140).reverse()
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && feedRef.current) feedRef.current.scrollTop = 0
  }, [items.length, autoScroll])

  return (
    <div ref={feedRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5" style={{ scrollbarWidth: 'thin' }}
      onScroll={(e) => { setAutoScroll((e.target as HTMLDivElement).scrollTop < 10) }}>
      {items.map((e) => (
        <div key={e.id}
          className={`relative pl-3 border-l-2 py-1.5 group hover:bg-white/[0.02] rounded-r-lg transition-all ${e.importance >= 0.7 ? 'bg-white/[0.01]' : ''}`}
          style={{ borderColor: eventColor(e.type) }}>
          <div className="absolute -left-[4px] top-2.5 w-[6px] h-[6px] rounded-full" style={{ background: eventColor(e.type), boxShadow: `0 0 6px ${eventColor(e.type)}44` }} />
          {/* Importance indicator */}
          {e.importance >= 0.7 && <div className="absolute right-0 top-1 text-[8px] text-yellow-400 opacity-60">⚡</div>}
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span className="font-bold text-gray-200 text-[11px] leading-tight">{e.title}</span>
            <span className="font-mono text-[9px] text-gray-600 flex-shrink-0">{fmtTime(e.ts)}</span>
          </div>
          <div className="text-[11px] text-gray-400 leading-relaxed">{e.text}</div>
          {e.participants?.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {e.participants.map((pid) => {
                const a = byId.get(pid)
                if (!a) return null
                return (
                  <button key={pid} onClick={() => props.onPickAgent(pid)}
                    className="text-[9px] px-1.5 py-0.5 rounded-md border font-bold transition-all hover:scale-105"
                    style={{ background: a.isAlive ? '#0c1a2b' : '#1a0505', borderColor: a.isAlive ? '#1a2a3e' : '#3b0d0d', color: a.isAlive ? '#9cb8d4' : '#ef4444' }}>
                    {a.emoji} {a.name}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/* ═══════ INSPECTOR ═══════ */
function Inspector(props: {
  state: WorldState; selectedAgent: AgentState | null; selectedLocation: LocationNode | null
  onPickAgent: (id: AgentId | null) => void; setGoal: (agentId: AgentId, goal: string) => void; sendChallenge: (locationId: LocationId, text: string) => void
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="p-2 grid grid-cols-1 gap-1 border-b" style={{ borderColor: '#1a2a3e' }}>
        {props.state.agents.map((x) => {
          // Find last action
          const lastEvent = props.state.feed.filter(e => e.participants?.includes(x.id)).slice(-1)[0]
          return (
            <button key={x.id} onClick={() => props.onPickAgent(x.id)}
              className={`flex items-center gap-2.5 p-2 rounded-lg transition-all ${!x.isAlive ? 'opacity-30' : ''}`}
              style={props.selectedAgent?.id === x.id ? { background: '#0f2234', border: '1px solid #0e7490' } : { border: '1px solid transparent' }}>
              <div className="text-lg relative">
                {x.emoji}
                {/* Activity dot */}
                {x.isAlive && lastEvent && Date.now() - lastEvent.ts < 15000 && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-900" style={{ background: eventColor(lastEvent.type), boxShadow: `0 0 6px ${eventColor(lastEvent.type)}88` }} />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${x.isAlive ? 'text-gray-100' : 'text-red-400 line-through'}`}>{x.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{roleRu(x.role)}</span>
                  {/* Last action label */}
                  {x.isAlive && lastEvent && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full ml-auto font-bold" style={{ background: eventColor(lastEvent.type) + '20', color: eventColor(lastEvent.type) }}>
                      {actionLabelRu(lastEvent.type)}
                    </span>
                  )}
                </div>
                {x.isAlive && (
                  <div className="flex items-center gap-3 mt-1">
                    <BarMini label="❤️" value={x.health} max={100} color={x.health > 60 ? '#22c55e' : x.health > 30 ? '#eab308' : '#ef4444'} />
                    <BarMini label="🍖" value={x.hunger} max={100} color={x.hunger < 40 ? '#22c55e' : x.hunger < 70 ? '#f59e0b' : '#ef4444'} />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
        {props.selectedAgent ? (
          <AgentDetail agent={props.selectedAgent} state={props.state} setGoal={props.setGoal} />
        ) : props.selectedLocation ? (
          <LocationDetail location={props.selectedLocation} state={props.state} sendChallenge={props.sendChallenge} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <div className="text-4xl mb-3 opacity-50">🏝️</div>
            <div className="text-xs italic">Кликните на агента или локацию</div>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentDetail(props: { agent: AgentState; state: WorldState; setGoal: (id: AgentId, g: string) => void }) {
  const [goalInput, setGoalInput] = useState('')
  const a = props.agent
  const loc = props.state.world.nodes.find(n => n.id === a.locationId)
  const agentEvents = props.state.feed.filter(e => e.participants?.includes(a.id)).slice(-5)

  const skillNames: Record<string, string> = { gathering: '⛏️ Сбор', crafting: '🔧 Крафт', combat: '⚔️ Бой', medicine: '💊 Медицина', building: '🏗️ Строй' }

  // Death card for dead agents
  if (!a.isAlive && a.deathLog) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border-2 text-center" style={{ background: 'linear-gradient(135deg, #1a0505, #2a0a0a)', borderColor: '#7f1d1d' }}>
          <div className="text-3xl mb-2">💀</div>
          <div className="text-lg font-bold text-red-400">{a.emoji} {a.name}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">R.I.P.</div>
          <div className="mt-3 p-2 rounded-lg text-xs" style={{ background: 'rgba(127,29,29,0.2)' }}>
            <div className="text-red-300 font-bold">Причина: <span className="text-red-400">{a.deathLog.cause}</span></div>
            <div className="text-gray-400 mt-1">Прожил <span className="text-white font-bold">{a.deathLog.day}</span> дней</div>
            <div className="text-gray-400">Действий: <span className="text-white font-bold">{a.deathLog.totalActions}</span></div>
          </div>
          {a.skills && (
            <div className="mt-3 flex flex-wrap gap-1 justify-center">
              {(Object.entries(a.skills) as [string, { level: number; xp: number }][]).map(([key, s]) => (
                <span key={key} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#1a0505', border: '1px solid #7f1d1d', color: '#f87171' }}>
                  {skillNames[key]?.split(' ')[0]} Лв{s.level}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Section title="ПРОФИЛЬ">
        <Row label="Роль" value={<span className="text-cyan-300">{a.emoji} {roleRu(a.role)}</span>} />
        <Row label="Локация" value={<span className="text-gray-300">{loc ? `${kindBuilding(loc.kind)} ${loc.name}` : '?'}</span>} />
        <Row label="Настрой" value={<span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: moodColor(a.mood.valence), color: '#000' }}>{moodLabel(a.mood)}</span>} />
        <Row label="HP" value={<BarInline value={a.health} max={100} color={a.health > 60 ? '#22c55e' : a.health > 30 ? '#eab308' : '#ef4444'} label={`${a.health}/100`} />} />
        <Row label="Голод" value={<BarInline value={a.hunger} max={100} color={a.hunger < 40 ? '#22c55e' : a.hunger < 70 ? '#f59e0b' : '#ef4444'} label={`${a.hunger}/100`} />} />
      </Section>

      {/* ★ THOUGHT BUBBLE */}
      {a.lastThought && (
        <div className="p-2 rounded-lg border text-xs italic" style={{ background: 'rgba(6, 30, 55, 0.8)', borderColor: '#164e63', color: '#67e8f9' }}>
          💭 «{a.lastThought}»
        </div>
      )}

      {/* ★ SKILLS */}
      {a.skills && (
        <Section title="⭐ НАВЫКИ">
          <div className="space-y-1.5">
            {(Object.entries(a.skills) as [string, { level: number; xp: number }][]).map(([key, s]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] w-20 text-gray-400">{skillNames[key] ?? key}</span>
                <span className="text-[10px] text-cyan-300 font-bold w-8">Лв{s.level}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#0a1525' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, (s.xp / (s.level * 50)) * 100)}%`,
                    background: s.level >= 3 ? 'linear-gradient(90deg, #f59e0b, #eab308)' : 'linear-gradient(90deg, #0d9488, #06b6d4)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="🎯 ТЕКУЩАЯ ЦЕЛЬ">
        <div className="text-xs text-cyan-200 italic mb-2 p-2 rounded-lg border" style={{ background: '#0a1828', borderColor: '#0e7490' }}>"{a.goal}"</div>
        {a.isAlive && (
          <div className="flex gap-1">
            <input value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Задать новую цель..."
              className="flex-1 text-xs px-2 py-1.5 rounded border focus:outline-none text-gray-200" style={{ background: '#0a1525', borderColor: '#1a2a3e' }}
              onKeyDown={e => { if (e.key === 'Enter' && goalInput.trim()) { props.setGoal(a.id, goalInput.trim()); setGoalInput('') } }} />
            <button onClick={() => { if (goalInput.trim()) { props.setGoal(a.id, goalInput.trim()); setGoalInput('') } }}
              disabled={!goalInput.trim()}
              className="px-3 py-1.5 rounded text-xs font-bold text-white disabled:opacity-30 transition-all" style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}>
              🎯
            </button>
          </div>
        )}
      </Section>

      {a.inventory.length > 0 && (
        <Section title="📦 ИНВЕНТАРЬ">
          <div className="flex flex-wrap gap-1">
            {a.inventory.map((item, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-md border font-bold" style={{ background: '#0c1a2b', borderColor: '#1a2a3e', color: '#9cb8d4' }}>
                {itemEmoji(item)} {item}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ★ CHEST at location */}
      {loc && loc.chest && loc.chest.length > 0 && (
        <Section title="🗃️ ОБЩИЙ СУНДУК">
          <div className="flex flex-wrap gap-1">
            {loc.chest.map((item, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-md border font-bold" style={{ background: '#1a1506', borderColor: '#854d0e', color: '#fbbf24' }}>
                {itemEmoji(item)} {item}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ★ Recent activity */}
      {agentEvents.length > 0 && (
        <Section title="📜 ПОСЛЕДНИЕ ДЕЙСТВИЯ">
          <div className="space-y-1">
            {agentEvents.reverse().map(e => (
              <div key={e.id} className="text-[10px] text-gray-400 flex items-start gap-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: eventColor(e.type) }} />
                <span>{e.title}: {e.text.slice(0, 60)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="🤝 СВЯЗИ">
        <RelationList selfId={a.id} relations={props.state.relations} agents={props.state.agents} />
      </Section>
    </div>
  )
}

function LocationDetail(props: { location: LocationNode; state: WorldState; sendChallenge: (id: LocationId, text: string) => void }) {
  const [challengeInput, setChallengeInput] = useState('')
  const loc = props.location
  const agentsHere = props.state.agents.filter(a => a.isAlive && a.locationId === loc.id)
  const res = Object.entries(loc.resources).filter(([, v]) => v > 0)

  return (
    <div className="space-y-4">
      <Section title="ЛОКАЦИЯ">
        <Row label="Название" value={<span className="text-cyan-300">{kindBuilding(loc.kind)} {loc.name}</span>} />
        <Row label="Тип" value={<span className="text-gray-300">{kindRu(loc.kind)}</span>} />
        <Row label="Укрытие" value={loc.shelter ? <span className="text-emerald-400">✅ Есть</span> : <span className="text-gray-500">❌ Нет</span>} />
      </Section>

      {res.length > 0 && (
        <Section title="РЕСУРСЫ">
          <div className="grid grid-cols-2 gap-1">
            {res.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs px-2 py-1 rounded border" style={{ background: '#0c1a2b', borderColor: '#1a2a3e' }}>
                <span>{itemEmoji(k)}</span>
                <span className="text-gray-300">{k}</span>
                <span className="ml-auto font-bold text-cyan-400">{v}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {agentsHere.length > 0 && (
        <Section title="АГЕНТЫ ЗДЕСЬ">
          <div className="space-y-1">
            {agentsHere.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded border text-xs" style={{ background: '#0c1a2b', borderColor: '#1a2a3e' }}>
                <span className="text-base">{a.emoji}</span>
                <span className="font-bold text-gray-200">{a.name}</span>
                <span className="text-gray-500">{roleRu(a.role)}</span>
                <span className="ml-auto text-emerald-400">❤️{a.health}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="⚡ БРОСИТЬ ИСПЫТАНИЕ">
        <div className="flex gap-1">
          <input value={challengeInput} onChange={e => setChallengeInput(e.target.value)} placeholder="Описание испытания..."
            className="flex-1 text-xs px-2 py-1.5 rounded border focus:outline-none text-gray-200" style={{ background: '#0a1525', borderColor: '#1a2a3e' }}
            onKeyDown={e => { if (e.key === 'Enter' && challengeInput.trim()) { props.sendChallenge(loc.id, challengeInput.trim()); setChallengeInput('') } }} />
          <button onClick={() => { if (challengeInput.trim()) { props.sendChallenge(loc.id, challengeInput.trim()); setChallengeInput('') } }}
            disabled={!challengeInput.trim()}
            className="px-3 py-1.5 rounded text-xs font-bold text-white disabled:opacity-30 transition-all" style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
            ⚡
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {[
            { emoji: '🐻', label: 'Хищник', text: 'Дикий хищник нападает на всех в этой локации!' },
            { emoji: '🌊', label: 'Потоп', text: 'Потоп! Вода заливает эту локацию!' },
            { emoji: '💎', label: 'Сокровище', text: 'Обнаружен тайник с ценными предметами!' },
            { emoji: '🔥', label: 'Пожар', text: 'Пожар! Локация объята пламенем!' },
            { emoji: '🏚️', label: 'Обвал', text: 'Обвал! Укрытие разрушается!' },
            { emoji: '🌪️', label: 'Ураган', text: 'Локальный ураган срывает всё на своём пути!' },
          ].map(ev => (
            <button key={ev.emoji} onClick={() => props.sendChallenge(loc.id, ev.text)}
              className="text-[10px] px-2 py-1 rounded-md border font-bold transition-all hover:scale-105 hover:brightness-125" style={{ background: '#1a0f0a', borderColor: '#3b2412', color: '#f59e0b' }}>
              {ev.emoji} {ev.label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}

/* ═══════ RELATION PANEL ═══════ */
function RelationPanel(props: { state: WorldState; selectedAgentId: AgentId | null; onPickAgent: (id: AgentId | null) => void }) {
  const agents = props.state.agents
  return (
    <div className="h-full overflow-auto p-6" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #061220 100%)' }}>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-cyan-300 tracking-wider">МАТРИЦА ОТНОШЕНИЙ</h2>
          <p className="text-xs text-gray-500 mt-1">Кликните на агента для подробностей</p>
        </div>
        {agents.map(a => (
          <div key={a.id} className="rounded-xl border p-4 transition-all cursor-pointer hover:border-cyan-800"
            style={{ background: a.id === props.selectedAgentId ? '#0f2234' : '#0c1a2b', borderColor: a.id === props.selectedAgentId ? '#0e7490' : '#1a2a3e' }}
            onClick={() => props.onPickAgent(a.id)}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{a.emoji}</span>
              <div>
                <div className={`font-bold ${a.isAlive ? 'text-white' : 'text-red-400 line-through'}`}>{a.name}</div>
                <div className="text-[10px] text-gray-500 font-mono">{roleRu(a.role)} • HP:{a.health} • 🍖:{a.hunger}</div>
              </div>
              <div className="ml-auto w-8 h-8 rounded-full" style={{ background: moodColor(a.mood.valence), boxShadow: `0 0 12px ${moodColor(a.mood.valence)}40` }} />
            </div>
            <div className="space-y-1.5">
              {props.state.relations.filter(r => r.a === a.id || r.b === a.id).map(r => {
                const otherId = r.a === a.id ? r.b : r.a
                const other = agents.find(x => x.id === otherId)
                if (!other) return null
                return (
                  <div key={otherId} className="flex items-center gap-2 text-xs">
                    <span>{other.emoji}</span>
                    <span className="text-gray-400 w-12">{other.name}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#0a1525' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${((r.affinity + 1) / 2) * 100}%`, background: affinityGradient(r.affinity) }} />
                    </div>
                    <span className={`font-mono text-[10px] w-12 text-right font-bold ${r.affinity > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.affinity > 0 ? '+' : ''}{r.affinity.toFixed(2)}</span>
                    <span className="font-mono text-[10px] text-blue-400 w-8 text-right">{r.trust.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════ SHARED COMPONENTS ═══════ */
function Section(props: { title: string; children: React.ReactNode }) {
  return (<div><div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-2 pb-1 border-b" style={{ borderColor: '#1a2a3e' }}>{props.title}</div>{props.children}</div>)
}
function Row(props: { label: string; value: React.ReactNode }) {
  return (<div className="flex items-center gap-2 py-0.5"><span className="text-gray-500 text-xs w-16 flex-shrink-0">{props.label}</span><span className="text-gray-200 text-xs">{props.value}</span></div>)
}
function BarMini(props: { label: string; value: number; max: number; color: string }) {
  return (<div className="flex items-center gap-1"><span className="text-[9px]">{props.label}</span><div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: '#0a1525' }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(props.value / props.max) * 100}%`, background: props.color, boxShadow: `0 0 4px ${props.color}60` }} /></div></div>)
}
function BarInline(props: { value: number; max: number; color: string; label: string }) {
  return (<div className="flex items-center gap-2"><div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: '#0a1525' }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(props.value / props.max) * 100}%`, background: props.color, boxShadow: `0 0 6px ${props.color}40` }} /></div><span className="text-[10px] text-gray-400 font-mono">{props.label}</span></div>)
}

function RelationList(props: { selfId: AgentId; relations: Relation[]; agents: AgentState[] }) {
  const byId = useMemo(() => new Map(props.agents.map(a => [a.id, a])), [props.agents])
  const rows = useMemo(() => {
    const out: Array<{ other: AgentState; affinity: number; trust: number }> = []
    for (const r of props.relations) {
      if (r.a === props.selfId) { const o = byId.get(r.b); if (o) out.push({ other: o, affinity: r.affinity, trust: r.trust }) }
      else if (r.b === props.selfId) { const o = byId.get(r.a); if (o) out.push({ other: o, affinity: r.affinity, trust: r.trust }) }
    }
    return out.sort((x, y) => y.affinity - x.affinity)
  }, [props.relations, props.selfId, byId])
  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.other.id} className="rounded-lg p-2 border" style={{ background: '#0c1a2b', borderColor: '#1a2a3e' }}>
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-[11px] text-gray-200">{r.other.emoji} {r.other.name}</span>
            <div className="flex gap-2 text-[9px] font-mono font-bold">
              <span className={r.affinity > 0 ? 'text-emerald-400' : 'text-red-400'}>{r.affinity > 0 ? '+' : ''}{r.affinity.toFixed(2)} ❤</span>
              <span className="text-blue-400">{r.trust.toFixed(2)} 🤝</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0a1525' }}>
            <div className="h-full transition-all duration-700 rounded-full" style={{ width: `${((r.affinity + 1) / 2) * 100}%`, background: affinityGradient(r.affinity) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════ UTILITIES ═══════ */
function roleRu(r: string) { const m: Record<string, string> = { Leader: 'Лидер', Scout: 'Разведчик', Medic: 'Медик', Builder: 'Строитель', Hunter: 'Охотник' }; return m[r] ?? r }
function kindRu(k: string) { const m: Record<string, string> = { beach: 'Пляж', jungle: 'Джунгли', mountain: 'Горы', cave: 'Пещера', lake: 'Озеро', camp: 'Лагерь' }; return m[k] ?? k }
function kindBuilding(kind: string) { const m: Record<string, string> = { beach: '🏖️', jungle: '🛖', mountain: '🏔️', cave: '⛏️', lake: '🏕️', camp: '⛺' }; return m[kind] ?? '📍' }
function fmtTime(ts: number) { return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
function moodLabel(m: { valence: number; arousal: number }) { if (m.valence > 0.35 && m.arousal > 0.2) return 'Воодушевлён'; if (m.valence > 0.35) return 'Спокоен'; if (m.valence < -0.35 && m.arousal > 0.2) return 'В панике'; if (m.valence < -0.35) return 'Подавлен'; if (m.arousal > 0.35) return 'Тревога'; return 'В норме' }
function moodColor(valence: number) { if (valence >= 0.5) return '#10b981'; if (valence >= 0.15) return '#34d399'; if (valence > -0.15) return '#3b82f6'; if (valence > -0.5) return '#f59e0b'; return '#ef4444' }
function affinityGradient(a: number) { if (a >= 0.5) return 'linear-gradient(90deg, #10b981, #059669)'; if (a >= 0.15) return 'linear-gradient(90deg, #34d399, #10b981)'; if (a > -0.15) return 'linear-gradient(90deg, #3b82f6, #2563eb)'; if (a > -0.5) return 'linear-gradient(90deg, #f59e0b, #d97706)'; return 'linear-gradient(90deg, #ef4444, #dc2626)' }
function eventColor(type: string) { const m: Record<string, string> = { attack: '#ef4444', death: '#dc2626', message: '#3b82f6', gather: '#22c55e', explore: '#10b981', craft: '#eab308', build: '#f59e0b', heal: '#ec4899', trade: '#a855f7', eat: '#f97316', weather: '#06b6d4', night: '#6366f1', world: '#f59e0b', rest: '#6b7280', goal: '#0ea5e9', move: '#475569', summarize: '#475569', beast_fight: '#f97316', challenge_result: '#a855f7', alliance: '#10b981', discovery: '#eab308', heroic: '#f59e0b' }; return m[type] ?? '#475569' }
function itemEmoji(item: string) { const m: Record<string, string> = { wood: '🪵', stone: '🪨', food: '🍖', fruit: '🍎', fish: '🐟', shellfish: '🦐', herbs: '🌿', water: '💧', driftwood: '🪵', cloth: '🧵', gems: '💎', ore: '⛏️', axe: '🪓', medicine: '💊', fishing_rod: '🎣', torch: '🔥', knife: '🔪', rope: '🪢' }; return m[item] ?? '📦' }
function actionLabelRu(type: string) { const m: Record<string, string> = { rest: 'Отдых', move: 'Движение', message: 'Говорит', attack: 'Бой', gather: 'Собирает', explore: 'Разведка', craft: 'Крафт', eat: 'Ест', build: 'Строит', trade: 'Торгует', heal: 'Лечит', goal: 'Цель', summarize: 'Думает', death: 'Смерть', weather: 'Погода', world: 'Событие', beast_fight: 'Зверь!', challenge_result: 'Испытание', alliance: 'Альянс', discovery: 'Находка', heroic: 'Герой!' }; return m[type] ?? type }
