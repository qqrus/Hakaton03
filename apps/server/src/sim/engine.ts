import { nanoid } from 'nanoid'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { z } from 'zod'
import type { AgentAction, AgentId, AgentState, DayPhase, EventEnvelope, LocationId, Relation, Weather, WorldGraph, WorldState } from './types.js'
import { neighbors, seedWorld } from './world.js'
import { seedAgents, decideAction, getCraftRecipes } from './agents.js'
import { MemoryStore } from './memory.js'
import { applyEventToMood, applySurvivalToMood, decayMood } from './mood.js'
import { bumpRelation, getRelation } from './relations.js'
import { OpenRouterClient } from './openrouter.js'
import { clamp, mulberry32, pick } from './rng.js'
import { createJsonlLogger } from './logger.js'

type EngineOpts = {
  tickMs: number
  onState: (s: WorldState) => void
  onEvent: (e: EventEnvelope) => void
}

const DAY_PHASES: DayPhase[] = ['dawn', 'day', 'day', 'day', 'dusk', 'night']
const WEATHERS: Weather[] = ['clear', 'clear', 'clear', 'rain', 'rain', 'fog', 'storm']

export function createEngine(opts: EngineOpts) {
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
  const keys = (process.env.OPENROUTER_KEYS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const defaultModel = process.env.OPENROUTER_DEFAULT_MODEL ?? 'deepseek/deepseek-r1:free'
  const reasoningEnabled = (process.env.OPENROUTER_REASONING ?? '').trim() === '1'
  const trace = createJsonlLogger(path.resolve(dataDir(), 'logs'))
  const llm = keys.length
    ? new OpenRouterClient({ baseUrl, keys, defaultModel, reasoningEnabled, onTrace: (rec) => trace.write(rec) })
    : null

  const world: WorldGraph = seedWorld(1337)
  const agents: AgentState[] = seedAgents(world, 2026)
  const relations: Relation[] = []
  const feed: EventEnvelope[] = []
  const nodesById = new Map(world.nodes.map((n) => [n.id, n]))

  // Pre-initialize all relations once
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      getRelation(relations, agents[i]!.id, agents[j]!.id)
    }
  }

  const memory = new MemoryStore(dataDir())
  for (const a of agents) memory.loadAgent(a.id)

  // Cache relations for fast lookup
  const relCache = new Map<string, Relation>()
  function rebuildRelCache() {
    relCache.clear()
    for (const r of relations) {
      relCache.set(`${r.a}:${r.b}`, r)
      relCache.set(`${r.b}:${r.a}`, r)
    }
  }
  rebuildRelCache()

  let speed = 1
  let running = false
  let timer: NodeJS.Timeout | null = null
  let tickCount = 0
  let currentDay = 1
  let dayPhaseIndex = 0
  let currentWeather: Weather = 'clear'

  function now() { return Date.now() }
  function getDayPhase(): DayPhase { return DAY_PHASES[dayPhaseIndex % DAY_PHASES.length]! }

  function getState(): WorldState {
    return {
      now: now(),
      speed,
      tick: tickCount,
      day: currentDay,
      dayPhase: getDayPhase(),
      weather: currentWeather,
      world,
      agents,
      relations,
      feed: feed.slice(-220),
    }
  }

  function pushEvent(ev: Omit<EventEnvelope, 'id' | 'ts'> & { ts?: number }) {
    const envelope: EventEnvelope = {
      id: nanoid(10),
      ts: ev.ts ?? now(),
      type: ev.type,
      title: ev.title,
      text: ev.text,
      locationId: ev.locationId,
      participants: ev.participants,
      importance: clamp(ev.importance, 0, 1),
    }
    feed.push(envelope)
    if (feed.length > 500) feed.splice(0, feed.length - 500)
    trace.write({ kind: 'event', event: envelope })
    opts.onEvent(envelope)
    applyEventSideEffects(envelope)
    opts.onState(getState())
    return envelope
  }

  function applyEventSideEffects(ev: EventEnvelope) {
    if (ev.participants?.length) {
      for (const pid of ev.participants) {
        const a = agents.find((x) => x.id === pid)
        if (!a) continue
        applyEventToMood(a.mood, ev.type, ev.importance)
        memory.add(a.id, ev.type === 'summarize' ? 'summary' : 'episode', ev.ts, `${ev.title}: ${ev.text}`, ev.importance, ev.participants)
      }
    }

    if (ev.type === 'attack' && ev.participants && ev.participants.length >= 2) {
      const [att, def] = ev.participants
      bumpRelation(relations, att!, def!, -0.35 * ev.importance, -0.25 * ev.importance)
      // Witnesses form opinions
      for (const other of agents) {
        if (other.id === att || other.id === def || !other.isAlive) continue
        if (other.locationId === agents.find(a => a.id === att)?.locationId) {
          const relDef = relCache.get(`${other.id}:${def!}`)
          if (relDef && relDef.affinity > 0.3) bumpRelation(relations, other.id, att!, -0.15, -0.1)
        }
      }
      rebuildRelCache()
    }

    if (ev.type === 'message' && ev.participants && ev.participants.length >= 2) {
      const [from, to] = ev.participants
      bumpRelation(relations, from!, to!, 0.04 * ev.importance, 0.02 * ev.importance)
      rebuildRelCache()
    }

    if (ev.type === 'heal' && ev.participants && ev.participants.length >= 2) {
      const [healer, patient] = ev.participants
      bumpRelation(relations, healer!, patient!, 0.2 * ev.importance, 0.15 * ev.importance)
      rebuildRelCache()
    }

    if (ev.type === 'trade' && ev.participants && ev.participants.length >= 2) {
      const [giver, receiver] = ev.participants
      bumpRelation(relations, giver!, receiver!, 0.12 * ev.importance, 0.08 * ev.importance)
      rebuildRelCache()
    }
  }

  function injectWorldEvent(text: string) {
    pushEvent({
      type: 'world',
      title: '🌍 Событие на острове',
      text,
      importance: 0.75,
      participants: agents.filter(a => a.isAlive).map(a => a.id),
    })
  }

  function injectUserMessage(toAgentId: AgentId, text: string) {
    pushEvent({
      type: 'message',
      title: '📡 Голос свыше',
      text: `[ПРИКАЗ ИГРОКА] ${text}`,
      participants: [toAgentId],
      importance: 0.95,
    })
  }

  function setAgentGoal(agentId: AgentId, goal: string) {
    const agent = agents.find(a => a.id === agentId)
    if (!agent || !agent.isAlive) return
    agent.goal = goal
    pushEvent({
      type: 'goal',
      title: `🎯 Новая цель: ${agent.name}`,
      text: `[ПРИКАЗ ИГРОКА] Цель: "${goal}"`,
      participants: [agentId],
      importance: 0.95,
    })
  }

  function injectLocationChallenge(locationId: LocationId, text: string) {
    const loc = nodesById.get(locationId)
    if (!loc) return
    const agentsHere = agents.filter(a => a.isAlive && a.locationId === locationId)
    const nearby = neighbors(world, locationId).flatMap(nid => agents.filter(a => a.isAlive && a.locationId === nid))
    const all = [...agentsHere, ...nearby]
    // Apply immediate damage for dangerous challenges
    const isDangerous = /хищник|зверь|шторм|потоп|пожар|атак|обвал/i.test(text)
    if (isDangerous) {
      for (const a of agentsHere) {
        a.health = clamp(a.health - 8, 0, 100)
        if (a.health <= 0) killAgent(a, `испытание: ${text.slice(0, 40)}`)
      }
    }
    pushEvent({
      type: 'world',
      title: `⚡ Испытание: ${loc.name}`,
      text: `[ИСПЫТАНИЕ] ${text}`,
      locationId,
      importance: 0.95,
      participants: all.map(a => a.id),
    })
  }

  function setSpeed(next: number) {
    speed = clamp(next, 0.25, 6)
    if (running) reschedule()
  }

  function start() {
    if (running) return
    running = true
    pushEvent({
      type: 'world',
      title: '🏝️ Кораблекрушение!',
      text: 'Пятеро выживших выброшены на берег необитаемого острова. Начинается борьба за выживание.',
      importance: 1.0,
      participants: agents.map(a => a.id),
    })
    reschedule()
  }

  function stop() {
    running = false
    if (timer) clearTimeout(timer)
    timer = null
    trace.close()
  }

  function reschedule() {
    if (!running) return
    if (timer) clearTimeout(timer)
    const delay = Math.max(120, Math.floor(opts.tickMs / speed))
    timer = setTimeout(async () => {
      await tick().catch(() => null)
      reschedule()
    }, delay)
  }

  async function tick() {
    tickCount++

    // === DAY/NIGHT CYCLE ===
    const prevPhase = getDayPhase()
    dayPhaseIndex = tickCount % DAY_PHASES.length
    const newPhase = getDayPhase()
    if (newPhase !== prevPhase) {
      if (newPhase === 'dawn') {
        currentDay++
        pushEvent({
          type: 'world',
          title: `☀️ День ${currentDay}`,
          text: `Наступает рассвет. Новый день на острове.`,
          importance: 0.4,
          participants: agents.filter(a => a.isAlive).map(a => a.id),
        })
      }
      if (newPhase === 'night') {
        pushEvent({
          type: 'night',
          title: '🌙 Ночь',
          text: 'Темнота окутывает остров. Хищники выходят на охоту.',
          importance: 0.35,
          participants: agents.filter(a => a.isAlive).map(a => a.id),
        })
      }
    }

    // === WEATHER ===
    if (tickCount % 4 === 0) {
      const rnd = mulberry32(tickCount * 7919 + 42)
      const prevWeather = currentWeather
      currentWeather = pick(rnd, WEATHERS)
      if (currentWeather !== prevWeather) {
        const weatherEmoji: Record<Weather, string> = { clear: '☀️', rain: '🌧️', storm: '⛈️', fog: '🌫️' }
        const weatherName: Record<Weather, string> = { clear: 'Ясно', rain: 'Дождь', storm: 'Шторм', fog: 'Туман' }
        pushEvent({
          type: 'weather',
          title: `${weatherEmoji[currentWeather]} ${weatherName[currentWeather]}`,
          text: currentWeather === 'storm'
            ? 'Мощный шторм обрушился на остров! Все без укрытия получают урон.'
            : `Погода: ${weatherName[currentWeather].toLowerCase()}.`,
          importance: currentWeather === 'storm' ? 0.7 : 0.25,
          participants: agents.filter(a => a.isAlive).map(a => a.id),
        })
      }
    }

    // === SURVIVAL MECHANICS ===
    for (const a of agents) {
      if (!a.isAlive) continue
      a.hunger = clamp(a.hunger + 3, 0, 100)
      if (a.hunger >= 90) {
        a.health = clamp(a.health - 5, 0, 100)
        if (a.health <= 0) { killAgent(a, 'голод и истощение'); continue }
      }
      if (currentWeather === 'storm') {
        const loc = nodesById.get(a.locationId)
        if (!loc?.shelter) {
          a.health = clamp(a.health - 4, 0, 100)
          if (a.health <= 0) { killAgent(a, 'шторм без укрытия'); continue }
        }
      }
      if (getDayPhase() === 'night') {
        const loc = nodesById.get(a.locationId)
        if (!loc?.shelter && !a.inventory.includes('torch')) a.health = clamp(a.health - 2, 0, 100)
      }
      const loc = nodesById.get(a.locationId)
      if (loc?.shelter && getDayPhase() !== 'night') a.health = clamp(a.health + 1, 0, 100)
      decayMood(a.mood)
      applySurvivalToMood(a.mood, a.health, a.hunger)
    }

    // === RESOURCE RESPAWN ===
    if (tickCount % 8 === 0) {
      const rnd = mulberry32(tickCount * 3571)
      for (const node of world.nodes) {
        const resKeys = Object.keys(node.resources)
        if (resKeys.length && rnd() < 0.35) {
          const key = pick(rnd, resKeys)
          node.resources[key] = (node.resources[key] ?? 0) + 1
        }
      }
    }

    // === AGENT DECISIONS ===
    const recent = feed.slice(-20)
    for (let idx = 0; idx < agents.length; idx++) {
      const agent = agents[idx]!
      if (!agent.isAlive) continue

      const query = [agent.goal, ...(recent.length ? [recent[recent.length - 1]!.text] : [])].join(' ')
      const memoryHits = memory.search(agent.id, query, 12)
      const memoryCount = memory.list(agent.id).length

      const action = await decideAction({
        agentIndex: idx,
        agent,
        world,
        nodesById,
        agents,
        relations,
        recentFeed: feed.slice(-25),
        memoryHits,
        memoryCount,
        llm,
        defaultModel,
        tick: tickCount,
        dayPhase: getDayPhase(),
        weather: currentWeather,
        day: currentDay,
      })
      applyAction(agent, action)
      agent.lastActionAt = now()
    }

    opts.onState(getState())
  }

  function killAgent(a: AgentState, cause: string) {
    a.isAlive = false
    a.health = 0
    a.deathLog = {
      cause,
      day: currentDay,
      survivalTime: tickCount,
      totalActions: feed.filter(e => e.participants?.includes(a.id)).length,
    }
    a.lastThought = `Прощайте...`
    pushEvent({
      type: 'death',
      title: `💀 ${a.name} погиб!`,
      text: `${a.name} не пережил: ${cause}. Прожил ${currentDay} дней. Навыки: Сбор Лв${a.skills.gathering.level}, Крафт Лв${a.skills.crafting.level}, Бой Лв${a.skills.combat.level}.`,
      participants: agents.filter(x => x.isAlive).map(x => x.id),
      importance: 1.0,
    })
  }

  async function stepOnce() { await tick() }

  // ★ Skill XP helper — levels up at 50 XP per level
  function addSkillXP(agent: AgentState, skill: keyof AgentState['skills'], amount: number) {
    const s = agent.skills[skill]
    s.xp += amount
    const xpNeeded = s.level * 50
    if (s.xp >= xpNeeded) {
      s.xp -= xpNeeded
      s.level++
      pushEvent({
        type: 'world',
        title: `⭐ ${agent.name}: Навык ↑`,
        text: `${skill === 'gathering' ? 'Сбор ресурсов' : skill === 'crafting' ? 'Крафт' : skill === 'combat' ? 'Бой' : skill === 'medicine' ? 'Медицина' : 'Строительство'} → Уровень ${s.level}!`,
        participants: [agent.id],
        locationId: agent.locationId,
        importance: 0.65,
      })
    }
  }

  function applyAction(agent: AgentState, action: AgentAction) {
    if (!agent.isAlive) return

    if (action.type === 'summarize') {
      summarizeAgent(agent.id)
      agent.lastThought = 'Записываю мысли...'
      pushEvent({ type: 'summarize', title: '📝 Дневник', text: `${agent.name} записывает мысли.`, participants: [agent.id], locationId: agent.locationId, importance: 0.2 })
      return
    }
    if (action.type === 'rest') {
      const loc = nodesById.get(agent.locationId)
      agent.health = clamp(agent.health + (loc?.shelter ? 5 : 2), 0, 100)
      agent.lastThought = loc?.shelter ? 'Отдыхаю в укрытии...' : 'Нужно отдохнуть...'
      pushEvent({ type: 'rest', title: `😴 ${agent.name} отдыхает`, text: `Восстановление сил${loc?.shelter ? ' в укрытии' : ''}.`, participants: [agent.id], locationId: agent.locationId, importance: 0.15 })
      return
    }
    if (action.type === 'set_goal') {
      agent.goal = action.goal
      agent.lastThought = `Новая цель: ${action.goal.slice(0, 30)}...`
      pushEvent({ type: 'goal', title: `🎯 ${agent.name}`, text: action.goal, participants: [agent.id], importance: 0.3 })
      return
    }
    if (action.type === 'move') {
      const from = nodesById.get(agent.locationId)?.name ?? '?'
      const toNode = nodesById.get(action.to)
      if (!toNode) return
      agent.locationId = toNode.id
      agent.lastThought = `Иду в ${toNode.name}...`
      pushEvent({ type: 'move', title: `🚶 ${agent.name}`, text: `${from} → ${toNode.name}`, participants: [agent.id], locationId: toNode.id, importance: 0.15 })
      return
    }
    if (action.type === 'gather') {
      const loc = nodesById.get(agent.locationId)
      if (!loc) return
      const cur = loc.resources[action.resource] ?? 0
      if (cur <= 0) return
      // Skill bonus: higher level = chance for double loot
      const bonus = agent.skills.gathering.level >= 3 && mulberry32(Date.now() + agent.id.charCodeAt(0))() < 0.3 ? 1 : 0
      const amount = 1 + bonus
      loc.resources[action.resource] = Math.max(0, cur - amount)
      for (let i = 0; i < amount; i++) {
        agent.inventory.push(action.resource)
        if (agent.inventory.length > 12) agent.inventory.shift()
      }
      addSkillXP(agent, 'gathering', 10)
      agent.lastThought = `Собираю ${action.resource}${bonus ? ' (x2!)' : ''}...`
      pushEvent({ type: 'gather', title: `📦 ${agent.name}`, text: `+${amount} ${action.resource} в ${loc.name}${bonus ? ' (бонус навыка!)' : ''}`, participants: [agent.id], locationId: loc.id, importance: 0.25 })
      return
    }
    if (action.type === 'eat') {
      const idx = agent.inventory.indexOf(action.item)
      if (idx === -1) return
      agent.inventory.splice(idx, 1)
      const nutrition = ['fish', 'shellfish'].includes(action.item) ? 35 : 25
      agent.hunger = clamp(agent.hunger - nutrition, 0, 100)
      agent.lastThought = `Ем ${action.item}. Вкусно!`
      pushEvent({ type: 'eat', title: `🍽️ ${agent.name}`, text: `Съел ${action.item}. Голод: ${agent.hunger}`, participants: [agent.id], locationId: agent.locationId, importance: 0.2 })
      return
    }
    if (action.type === 'craft') {
      const recipes = getCraftRecipes()
      const recipe = recipes.find(r => r.result === action.item)
      if (!recipe) return
      for (const ing of recipe.ingredients) {
        const idx = agent.inventory.indexOf(ing)
        if (idx === -1) return
        agent.inventory.splice(idx, 1)
      }
      agent.inventory.push(recipe.result)
      addSkillXP(agent, 'crafting', 15)
      agent.lastThought = `Создал ${recipe.result}!`
      pushEvent({ type: 'craft', title: `🔧 ${agent.name}`, text: `Создал ${recipe.result}: ${recipe.desc}. Крафт Лв${agent.skills.crafting.level}`, participants: [agent.id], locationId: agent.locationId, importance: 0.5 })
      return
    }
    if (action.type === 'build') {
      const loc = nodesById.get(agent.locationId)
      if (!loc || loc.shelter) return
      const woodIdx = agent.inventory.indexOf('wood')
      if (woodIdx === -1) return
      agent.inventory.splice(woodIdx, 1)
      loc.shelter = true
      addSkillXP(agent, 'building', 20)
      agent.lastThought = `Построил укрытие!`
      pushEvent({ type: 'build', title: `🏗️ ${agent.name}`, text: `Укрытие в ${loc.name}! Строительство Лв${agent.skills.building.level}`, participants: [agent.id], locationId: loc.id, importance: 0.6 })
      return
    }
    if (action.type === 'explore') {
      const loc = nodesById.get(agent.locationId)
      if (!loc) return
      const rnd = mulberry32(Number.parseInt(agent.id.slice(0, 4), 36) + Date.now())
      const findChance = agent.role === 'Scout' ? 0.55 : 0.3
      agent.lastThought = `Исследую ${loc.name}...`
      if (rnd() < findChance) {
        const finds = ['food', 'herbs', 'cloth', 'driftwood', 'gems']
        const found = pick(rnd, finds)
        agent.inventory.push(found)
        if (agent.inventory.length > 12) agent.inventory.shift()
        agent.lastThought = `Нашёл ${found}!`
        addSkillXP(agent, 'gathering', 5)
        pushEvent({ type: 'explore', title: `🔍 ${agent.name}`, text: `Нашёл ${found} в ${loc.name}!`, participants: [agent.id], locationId: loc.id, importance: 0.4 })
      } else {
        pushEvent({ type: 'explore', title: `🔍 ${agent.name}`, text: `Ничего нового в ${loc.name}.`, participants: [agent.id], locationId: loc.id, importance: 0.1 })
      }
      return
    }
    if (action.type === 'trade') {
      const to = agents.find(a => a.id === action.to && a.isAlive)
      if (!to || to.locationId !== agent.locationId) return
      const idx = agent.inventory.indexOf(action.item)
      if (idx === -1) return
      agent.inventory.splice(idx, 1)
      to.inventory.push(action.item)
      if (to.inventory.length > 12) to.inventory.shift()
      agent.lastThought = `Отдал ${action.item} для ${to.name}`
      pushEvent({ type: 'trade', title: `🤝 ${agent.name} → ${to.name}`, text: `Передал ${action.item}`, participants: [agent.id, to.id], locationId: agent.locationId, importance: 0.35 })
      return
    }
    if (action.type === 'heal') {
      const target = agents.find(a => a.id === action.target && a.isAlive)
      if (!target || target.locationId !== agent.locationId) return
      let healItem = ''
      // Skill bonus: higher medicine level = more HP restored
      const healBonus = Math.floor(agent.skills.medicine.level * 3)
      const medIdx = agent.inventory.indexOf('medicine')
      if (medIdx !== -1) { agent.inventory.splice(medIdx, 1); healItem = 'medicine'; target.health = clamp(target.health + 30 + healBonus, 0, 100) }
      else {
        const herbIdx = agent.inventory.indexOf('herbs')
        if (herbIdx === -1) return
        agent.inventory.splice(herbIdx, 1); healItem = 'herbs'; target.health = clamp(target.health + 15 + healBonus, 0, 100)
      }
      addSkillXP(agent, 'medicine', 15)
      agent.lastThought = `Лечу ${target.name}!`
      pushEvent({ type: 'heal', title: `💊 ${agent.name} → ${target.name}`, text: `${healItem}. HP: ${target.health}/100. Медицина Лв${agent.skills.medicine.level}`, participants: [agent.id, target.id], locationId: agent.locationId, importance: 0.55 })
      return
    }
    if (action.type === 'message') {
      const to = agents.find(a => a.id === action.to)
      if (!to) return
      agent.lastThought = `Говорю с ${to.name}...`
      pushEvent({ type: 'message', title: `💬 ${agent.name} → ${to.name}`, text: action.text, participants: [agent.id, to.id], locationId: agent.locationId, importance: 0.25 })
      return
    }
    if (action.type === 'attack') {
      const target = agents.find(a => a.id === action.target && a.isAlive)
      if (!target || target.locationId !== agent.locationId) return
      const rnd = mulberry32(Number.parseInt(agent.id.slice(0, 4), 36) + Date.now())
      const hasKnife = agent.inventory.includes('knife')
      // Combat skill bonus
      const skillBonus = agent.skills.combat.level * 0.05
      const atk = clamp(0.5 + agent.traits.aggression * 0.2 + (hasKnife ? 0.15 : 0) + skillBonus + rnd() * 0.2, 0, 1)
      const def = clamp(0.4 + target.traits.endurance * 0.15 + target.skills.combat.level * 0.03 + rnd() * 0.2, 0, 1)
      const win = atk >= def
      const dmg = Math.floor(10 + rnd() * 15 + agent.skills.combat.level * 2)
      const loc = nodesById.get(agent.locationId)?.name ?? '?'
      addSkillXP(agent, 'combat', 10)
      agent.lastThought = win ? `Победил ${target.name}!` : `${target.name} дал отпор...`
      if (win) {
        target.health = clamp(target.health - dmg, 0, 100)
        pushEvent({ type: 'attack', title: `⚔️ ${agent.name} → ${target.name}`, text: `${agent.name} побеждает в ${loc}! -${dmg} HP (${target.health}). Бой Лв${agent.skills.combat.level}`, participants: [agent.id, target.id], locationId: agent.locationId, importance: 0.8 })
        if (target.health <= 0) killAgent(target, `бой с ${agent.name}`)
      } else {
        agent.health = clamp(agent.health - Math.floor(dmg * 0.6), 0, 100)
        pushEvent({ type: 'attack', title: `⚔️ ${agent.name} → ${target.name}`, text: `${target.name} даёт отпор! -${Math.floor(dmg * 0.6)} HP (${agent.health})`, participants: [agent.id, target.id], locationId: agent.locationId, importance: 0.7 })
      }
      bumpRelation(relations, agent.id, target.id, -0.3, -0.2)
      rebuildRelCache()
      return
    }
  }

  function summarizeAgent(agentId: AgentId) {
    const entries = memory.list(agentId)
    if (entries.length < 170) return
    const chunk = memory.takeOldest(agentId, 45)
    const text = chunk.map(e => e.text).join('\n')
    const summaryText = heuristicSummary(chunk, text)
    const kept = entries.slice(chunk.length)
    memory.replaceWith(agentId, kept)
    memory.add(agentId, 'summary', now(), summaryText, 0.55)
  }

  function heuristicSummary(chunk: { text: string }[], full: string) {
    const lines = chunk.slice(-16).map(x => x.text.replace(/\s+/g, ' ').slice(0, 140)).filter(Boolean)
    const tag = full.includes('голод') || full.includes('ест') ? 'Выживание'
      : full.includes('атак') || full.includes('нападает') ? 'Конфликты'
        : full.includes('строит') || full.includes('создаёт') ? 'Строительство'
          : 'Ход событий'
    return `${tag} (сводка):\n- ${lines.join('\n- ')}`
  }

  function dataDir() {
    const here = path.dirname(fileURLToPath(import.meta.url))
    return path.resolve(here, '../../../data')
  }

  return {
    start,
    stop,
    stepOnce,
    getState,
    setSpeed,
    injectWorldEvent,
    injectUserMessage,
    setAgentGoal,
    injectLocationChallenge,
  }
}
