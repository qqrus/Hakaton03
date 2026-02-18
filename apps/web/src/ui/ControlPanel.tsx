import { useState } from 'react'
import type { AgentId, AgentState } from './types'

interface ControlPanelProps {
  onInjectEvent: (text: string) => void
  onSendMessage: (agentId: AgentId, text: string) => void
  onSetGoal: (agentId: AgentId, goal: string) => void
  selectedAgentId: AgentId | null
  agents: AgentState[]
}

const PRESET_EVENTS = [
  { emoji: '⛈️', label: 'Шторм', text: 'Мощный шторм обрушивается на остров!' },
  { emoji: '🐻', label: 'Хищник', text: 'Дикий зверь напал на выживших!' },
  { emoji: '💎', label: 'Клад', text: 'Найден тайник с ценными предметами!' },
  { emoji: '🚢', label: 'Обломки', text: 'Волны прибили обломки корабля!' },
  { emoji: '🌊', label: 'Потоп', text: 'Уровень воды поднимается! Наводнение!' },
  { emoji: '🏥', label: 'Аптечка', text: 'Найдена аптечка с медикаментами!' },
  { emoji: '🔥', label: 'Пожар', text: 'Пожар вспыхнул на острове! Всё горит!' },
  { emoji: '🏚️', label: 'Обвал', text: 'Обвал разрушил укрытие! Камнепад!' },
  { emoji: '🌪️', label: 'Ураган', text: 'Ураган налетел! Ветер сносит всё на пути!' },
  { emoji: '🗿', label: 'Тайна', text: 'Странные древние руины обнаружены в глубине острова!' },
]

export function ControlPanel(props: ControlPanelProps) {
  const [eventInput, setEventInput] = useState('')
  const [msgInput, setMsgInput] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedAgent = props.agents.find(a => a.id === props.selectedAgentId)

  async function inject(text: string) {
    setBusy(true)
    try { props.onInjectEvent(text) } finally { setBusy(false) }
    setEventInput('')
  }

  async function send(agentId: AgentId) {
    setBusy(true)
    try { props.onSendMessage(agentId, msgInput) } finally { setBusy(false) }
    setMsgInput('')
  }

  return (
    <div className="space-y-3">
      {/* Quick Events */}
      <div>
        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-1.5">⚡ СОБЫТИЯ</div>
        <div className="grid grid-cols-3 gap-1">
          {PRESET_EVENTS.map(ev => (
            <button key={ev.label} onClick={() => inject(ev.text)} disabled={busy}
              className="text-[10px] py-1.5 px-1 rounded-md border font-bold transition-all hover:scale-[1.02] disabled:opacity-30"
              style={{ background: '#0c1a2b', borderColor: '#1a2a3e', color: '#9cb8d4' }}>
              {ev.emoji} {ev.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Event */}
      <div>
        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-1">🌍 СВОЁ СОБЫТИЕ</div>
        <div className="flex gap-1">
          <input value={eventInput} onChange={e => setEventInput(e.target.value)} placeholder="Описание..."
            className="flex-1 border rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none transition-colors" style={{ background: '#0a1525', borderColor: '#1a2a3e' }} />
          <button onClick={() => inject(eventInput)} disabled={!eventInput.trim() || busy}
            className="px-3 py-1.5 rounded text-xs font-bold text-white disabled:opacity-30 transition-all" style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}>
            ▶
          </button>
        </div>
      </div>

      {/* Message to Agent */}
      {selectedAgent && selectedAgent.isAlive && (
        <div>
          <div className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-1">💬 {selectedAgent.emoji} {selectedAgent.name}</div>
          <div className="flex gap-1">
            <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder={`Написать ${selectedAgent.name}...`}
              className="flex-1 border rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none transition-colors" style={{ background: '#0a1525', borderColor: '#1a2a3e' }} />
            <button onClick={() => send(selectedAgent.id)} disabled={!msgInput.trim() || busy}
              className="px-3 py-1.5 rounded text-xs font-bold text-white disabled:opacity-30 transition-all" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
              ✉
            </button>
          </div>
        </div>
      )}
    </div>
  )
}