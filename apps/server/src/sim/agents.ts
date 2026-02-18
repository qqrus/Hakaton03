import { nanoid } from 'nanoid'
import { z } from 'zod'
import type { AgentAction, AgentRole, AgentState, EventEnvelope, LocationNode, Relation, WorldGraph, DayPhase, Weather } from './types.js'
import { clamp, mulberry32, pick } from './rng.js'
import { neighbors } from './world.js'
import { getOpinion, getRelation } from './relations.js'
import type { MemorySearchHit } from './memory.js'
import type { OpenRouterClient } from './openrouter.js'

export function seedAgents(world: WorldGraph, seed = 2026): AgentState[] {
  const rnd = mulberry32(seed)
  const campId = world.nodes[0]!.id
  const pickNearCamp = () => {
    const nbs = neighbors(world, campId)
    return rnd() < 0.5 ? campId : pick(rnd, nbs)
  }

  return [
    mkAgent('Алекс', 'Leader', '👨‍✈️', campId,
      'Объединить всех и наладить лагерь для выживания.',
      { empathy: 0.75, aggression: 0.2, resourcefulness: 0.7, endurance: 0.8, curiosity: 0.5 },
      { personality: 'Спокойный лидер. Думает о команде, распределяет задачи, мотивирует.', constraints: ['Не бросай союзников.', 'Сначала обеспечь безопасность группы.'], priorities: ['Координация команды', 'Строительство укрытий', 'Распределение ресурсов'] }),
    mkAgent('Мика', 'Scout', '🧭', pickNearCamp(),
      'Исследовать остров и найти ценные ресурсы.',
      { empathy: 0.45, aggression: 0.15, resourcefulness: 0.6, endurance: 0.7, curiosity: 0.95 },
      { personality: 'Любопытный разведчик. Не сидит на месте, всегда в поиске нового.', constraints: ['Не рискуй без причины.', 'Сообщай находки команде.'], priorities: ['Исследование новых мест', 'Поиск ресурсов', 'Разведка территории'] }),
    mkAgent('Рина', 'Medic', '💊', campId,
      'Лечить раненых и собирать лечебные травы.',
      { empathy: 0.95, aggression: 0.05, resourcefulness: 0.65, endurance: 0.55, curiosity: 0.6 },
      { personality: 'Заботливый медик. Всегда помогает, переживает за каждого.', constraints: ['Не оставляй раненых.', 'Приоритет — здоровье людей.'], priorities: ['Сбор трав и лечение', 'Забота о раненых', 'Создание лекарств'] }),
    mkAgent('Дима', 'Builder', '🔨', campId,
      'Построить надёжные укрытия и полезные инструменты.',
      { empathy: 0.5, aggression: 0.12, resourcefulness: 0.92, endurance: 0.85, curiosity: 0.35 },
      { personality: 'Практичный строитель. Молчаливый, но делает больше всех руками.', constraints: ['Сначала собери материалы.', 'Не трать ресурсы зря.'], priorities: ['Строительство укрытий', 'Крафт инструментов', 'Добыча дерева и камня'] }),
    mkAgent('Зара', 'Hunter', '🏹', pickNearCamp(),
      'Обеспечить группу едой через рыбалку и охоту.',
      { empathy: 0.3, aggression: 0.65, resourcefulness: 0.75, endurance: 0.9, curiosity: 0.4 },
      { personality: 'Смелый охотник. Прямой, резкий, уважает действия больше слов.', constraints: ['Не охоться без нужды.', 'Защищай лагерь от угроз.'], priorities: ['Рыбалка и добыча еды', 'Защита от хищников', 'Разведка опасных зон'] }),
  ]
}

function mkAgent(
  name: string, role: AgentRole, emoji: string, locationId: string, goal: string,
  traits: AgentState['traits'], profile: AgentState['profile'],
): AgentState {
  const defaultSkills = {
    gathering: { level: 1, xp: 0 },
    crafting: { level: 1, xp: 0 },
    combat: { level: 1, xp: 0 },
    medicine: { level: 1, xp: 0 },
    building: { level: 1, xp: 0 },
  }
  return {
    id: nanoid(10), name, role, avatarSeed: `${name}-${role}`, emoji, traits, profile,
    locationId, mood: { valence: 0.1, arousal: 0.05 }, goal, health: 100, hunger: 10,
    inventory: [], isAlive: true, lastActionAt: 0, skills: defaultSkills, lastThought: '',
  }
}

const actionSchema: z.ZodType<AgentAction> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rest') }),
  z.object({ type: z.literal('move'), to: z.string().min(1) }),
  z.object({ type: z.literal('message'), to: z.string().min(1), text: z.string().min(1).max(500) }),
  z.object({ type: z.literal('attack'), target: z.string().min(1) }),
  z.object({ type: z.literal('gather'), resource: z.string().min(1).max(32) }),
  z.object({ type: z.literal('set_goal'), goal: z.string().min(1).max(180) }),
  z.object({ type: z.literal('summarize') }),
  z.object({ type: z.literal('craft'), item: z.string().min(1).max(32) }),
  z.object({ type: z.literal('eat'), item: z.string().min(1).max(32) }),
  z.object({ type: z.literal('build') }),
  z.object({ type: z.literal('explore') }),
  z.object({ type: z.literal('trade'), to: z.string().min(1), item: z.string().min(1).max(32) }),
  z.object({ type: z.literal('heal'), target: z.string().min(1) }),
])

export type DecideActionInput = {
  agentIndex: number
  agent: AgentState
  world: WorldGraph
  nodesById: Map<string, LocationNode>
  agents: AgentState[]
  relations: Relation[]
  recentFeed: EventEnvelope[]
  memoryHits: MemorySearchHit[]
  memoryCount: number
  llm: OpenRouterClient | null
  defaultModel: string
  tick: number
  dayPhase: DayPhase
  weather: Weather
  day: number
}

export async function decideAction(input: DecideActionInput): Promise<AgentAction> {
  if (!input.agent.isAlive) return { type: 'rest' }
  const sys = systemPrompt(input.agent, input)
  const user = userPrompt(input)
  const action =
    (await input.llm?.chatJson({
      agentIndex: input.agentIndex,
      model: input.defaultModel,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      schema: actionSchema,
      maxTokens: 280,
    })) ?? null

  if (action) return sanitizeAction(action, input)
  return fallbackAction(input)
}

function sanitizeAction(action: AgentAction, input: DecideActionInput): AgentAction {
  if (action.type === 'move') {
    const nbs = neighbors(input.world, input.agent.locationId)
    if (!nbs.includes(action.to)) return { type: 'move', to: pick(mulberry32(Date.now()), nbs) ?? input.agent.locationId }
  }
  if (action.type === 'attack') {
    const tgt = input.agents.find((a) => a.id === action.target)
    if (!tgt || tgt.locationId !== input.agent.locationId || !tgt.isAlive) return { type: 'rest' }
    const rel = getRelation(input.relations, input.agent.id, tgt.id)
    if ((input.agent.role === 'Medic' || input.agent.role === 'Builder') && rel.affinity > -0.85) {
      return { type: 'message', to: tgt.id, text: 'Мне не до драк. Давай решим мирно.' }
    }
  }
  if (action.type === 'message') {
    const tgt = input.agents.find((a) => a.id === action.to && a.isAlive)
    if (!tgt) {
      // Target dead/missing — talk to someone else nearby
      const nearby = input.agents.find(a => a.locationId === input.agent.locationId && a.id !== input.agent.id && a.isAlive)
      if (nearby) return { type: 'message', to: nearby.id, text: action.text.trim().slice(0, 500) }
      return { type: 'rest' }
    }
    // Anti-spam: block only exact duplicate text within 5s
    const prev = input.recentFeed.find(e => e.participants?.includes(input.agent.id) && e.type === 'message' && e.ts > Date.now() - 5000)
    if (prev && prev.text === action.text.trim()) {
      // Say something else instead
      return { type: 'message', to: action.to, text: generateConversation(input, tgt) }
    }
    return { type: 'message', to: action.to, text: action.text.trim().slice(0, 500) }
  }
  if (action.type === 'gather') {
    const loc = input.nodesById.get(input.agent.locationId)
    if (!loc || !loc.resources[action.resource]) {
      const keys = loc ? Object.keys(loc.resources).filter(k => (loc.resources[k] ?? 0) > 0) : []
      if (keys.length === 0) return { type: 'rest' }
      return { type: 'gather', resource: keys[0]! }
    }
  }
  if (action.type === 'set_goal') {
    return { type: 'set_goal', goal: action.goal.trim().slice(0, 180) }
  }
  if (action.type === 'summarize') {
    if (input.memoryCount < 140) return { type: 'rest' }
  }
  if (action.type === 'eat') {
    if (!input.agent.inventory.includes(action.item)) {
      const food = input.agent.inventory.find(i => ['food', 'fruit', 'fish', 'shellfish'].includes(i))
      if (food) return { type: 'eat', item: food }
      return { type: 'rest' }
    }
  }
  if (action.type === 'craft') {
    const recipes = getCraftRecipes()
    const recipe = recipes.find(r => r.result === action.item)
    if (!recipe) return { type: 'rest' }
    const canCraft = recipe.ingredients.every(ing => input.agent.inventory.includes(ing))
    if (!canCraft) return { type: 'gather', resource: recipe.ingredients[0]! }
  }
  if (action.type === 'heal') {
    const tgt = input.agents.find(a => a.id === action.target && a.isAlive)
    if (!tgt || tgt.locationId !== input.agent.locationId) return { type: 'rest' }
    if (!input.agent.inventory.includes('medicine') && !input.agent.inventory.includes('herbs')) return { type: 'rest' }
  }
  if (action.type === 'trade') {
    const tgt = input.agents.find(a => a.id === action.to && a.isAlive)
    if (!tgt || tgt.locationId !== input.agent.locationId) return { type: 'rest' }
    if (!input.agent.inventory.includes(action.item)) return { type: 'rest' }
  }
  return action
}

export function getCraftRecipes() {
  return [
    { result: 'axe', ingredients: ['wood', 'stone'], desc: 'Топор — улучшает добычу дерева' },
    { result: 'medicine', ingredients: ['herbs', 'water'], desc: 'Лекарство — лечит 30 HP' },
    { result: 'fishing_rod', ingredients: ['wood', 'driftwood'], desc: 'Удочка — улучшает рыбалку' },
    { result: 'torch', ingredients: ['wood', 'cloth'], desc: 'Факел — защита ночью' },
    { result: 'knife', ingredients: ['stone', 'wood'], desc: 'Нож — универсальный инструмент' },
    { result: 'rope', ingredients: ['cloth', 'cloth'], desc: 'Верёвка — для строительства' },
  ]
}

function fallbackAction(input: DecideActionInput): AgentAction {
  const rnd = mulberry32(Date.now() + input.agentIndex * 97)
  if (!input.agent.isAlive) return { type: 'rest' }

  // ★ PLAYER DIRECTIVE PRIORITY: check if there is a recent user goal/message/challenge
  const playerDirective = extractPlayerDirective(input)
  if (playerDirective) return playerDirective

  // Eat if hungry
  if (input.agent.hunger > 55) {
    const food = input.agent.inventory.find(i => ['food', 'fruit', 'fish', 'shellfish'].includes(i))
    if (food) return { type: 'eat', item: food }
  }

  if (input.memoryCount >= 180 && rnd() < 0.2) return { type: 'summarize' }

  const here = input.agent.locationId
  const loc = input.nodesById.get(here)
  const othersHere = input.agents.filter((a) => a.locationId === here && a.id !== input.agent.id && a.isAlive)

  // Heal wounded (urgent — before communication)
  if (input.agent.role === 'Medic' || input.agent.inventory.includes('medicine')) {
    const wounded = othersHere.find(a => a.health < 60)
    if (wounded && (input.agent.inventory.includes('medicine') || input.agent.inventory.includes('herbs'))) {
      return { type: 'heal', target: wounded.id }
    }
  }

  // ★★★ COMMUNICATION FIRST — agents should talk A LOT ★★★
  if (othersHere.length > 0 && rnd() < 0.55) {
    const other = pick(rnd, othersHere)
    const r = getRelation(input.relations, input.agent.id, other.id)
    // Enemies argue, friends cooperate, neutrals discuss
    if (r.affinity < -0.55 && rnd() < 0.25) return { type: 'attack', target: other.id }
    return { type: 'message', to: other.id, text: generateConversation(input, other) }
  }

  // Build shelter
  if (loc && !loc.shelter && input.agent.inventory.includes('wood') && rnd() < 0.3) return { type: 'build' }

  // Gather
  const res = loc ? Object.entries(loc.resources).filter(([, v]) => v > 0) : []
  if (res.length && rnd() < 0.3) return { type: 'gather', resource: res[Math.floor(rnd() * res.length)]![0] }

  // Explore
  if ((input.agent.role === 'Scout' || rnd() < 0.15) && rnd() < 0.25) return { type: 'explore' }

  // Craft
  const recipes = getCraftRecipes()
  for (const recipe of recipes) {
    if (recipe.ingredients.every(i => input.agent.inventory.includes(i)) && rnd() < 0.3) {
      return { type: 'craft', item: recipe.result }
    }
  }

  // Trade (with dialogue!)
  if (othersHere.length && input.agent.inventory.length > 2 && rnd() < 0.15) {
    const other = pick(rnd, othersHere)
    const item = input.agent.inventory[Math.floor(rnd() * input.agent.inventory.length)]!
    return { type: 'trade', to: other.id, item }
  }

  // Move towards other agents if alone (seek company)
  if (othersHere.length === 0 && rnd() < 0.4) {
    const nbs = neighbors(input.world, here)
    for (const nb of nbs) {
      const there = input.agents.filter(a => a.locationId === nb && a.isAlive)
      if (there.length > 0) return { type: 'move', to: nb }
    }
  }

  if (rnd() < 0.08) return { type: 'rest' }

  const nbs = neighbors(input.world, here)
  if (nbs.length === 0) return { type: 'rest' }
  return { type: 'move', to: pick(rnd, nbs) }
}

/** ★ Generate diverse, context-aware conversation text */
function generateConversation(input: DecideActionInput, other: AgentState): string {
  const rnd = mulberry32(Date.now() + input.agentIndex * 31 + other.id.charCodeAt(0))
  const agent = input.agent
  const r = getRelation(input.relations, agent.id, other.id)
  const loc = input.nodesById.get(agent.locationId)
  const pool: string[] = []

  // ═══════ 1. REACT TO RECENT EVENTS (highest priority — makes conversation alive) ═══════
  const recentEvents = input.recentFeed.slice(-15)

  // React to recent attacks
  const recentAttacks = recentEvents.filter(e => e.type === 'attack')
  for (const atk of recentAttacks) {
    const isParticipant = atk.participants?.includes(agent.id) || atk.participants?.includes(other.id)
    if (isParticipant) {
      pool.push(`${other.name}, ты видел что произошло?! ${atk.text}`)
      pool.push(`Это было жестоко... ${atk.title}. Мы должны быть осторожнее.`)
      pool.push(`После этой драки нам нужно держаться вместе, ${other.name}.`)
    } else {
      pool.push(`${other.name}, слышал что случилось? ${atk.title}! Надо разобраться.`)
      pool.push(`На острове неспокойно... Кто-то снова подрался. ${atk.text}`)
    }
  }

  // React to recent deaths
  const recentDeaths = recentEvents.filter(e => e.type === 'death')
  for (const death of recentDeaths) {
    pool.push(`${other.name}... ${death.title}. Я не могу в это поверить.`)
    pool.push(`Мы потеряли человека... ${death.text}. Нас теперь меньше.`)
    pool.push(`Это могло случиться с любым из нас. ${other.name}, нужно быть осторожнее!`)
  }

  // React to challenges/world events
  const recentChallenges = recentEvents.filter(e => e.type === 'world' && e.importance >= 0.7)
  for (const ch of recentChallenges) {
    pool.push(`${other.name}, ты в курсе?! ${ch.text}`)
    pool.push(`Остров испытывает нас... ${ch.title}. Что будем делать?`)
    pool.push(`После всего что случилось — ${ch.text.slice(0, 60)} — нам нужен новый план.`)
  }

  // React to weather changes
  const recentWeather = recentEvents.filter(e => e.type === 'weather')
  for (const w of recentWeather) {
    pool.push(`${other.name}, погода меняется! ${w.text}`)
  }

  // React to someone's crafting/building
  const recentCrafts = recentEvents.filter(e => e.type === 'craft' || e.type === 'build')
  for (const c of recentCrafts) {
    if (!c.participants?.includes(agent.id)) {
      pool.push(`Хорошая работа! ${c.text} — это нам пригодится.`)
      pool.push(`Я видел: ${c.title}. Молодец! Нам нужно больше такого.`)
    }
  }

  // React to someone exploring/finding
  const recentExplore = recentEvents.filter(e => e.type === 'explore' && e.text.includes('Нашёл'))
  for (const ex of recentExplore) {
    if (!ex.participants?.includes(agent.id)) {
      pool.push(`${other.name}, ${ex.text} — а ты что-нибудь нашёл?`)
    }
  }

  // ═══════ 2. COOPERATIVE PLANNING ═══════
  const aliveCount = input.agents.filter(a => a.isAlive).length
  const locationsWithShelter = Array.from(input.nodesById.values()).filter(n => n.shelter)
  const locationsWithoutShelter = Array.from(input.nodesById.values()).filter(n => !n.shelter)

  // Group survival discussion
  pool.push(`${other.name}, нас осталось ${aliveCount}. Нужно распределить задачи: кто за еду, кто строит.`)
  pool.push(`Предлагаю план: ${other.role === 'Hunter' || other.role === 'Scout' ? 'ты ищи ресурсы' : 'ты останься в лагере'}, а я ${agent.role === 'Scout' ? 'пойду на разведку' : 'займусь здесь'}.`)

  if (locationsWithShelter.length > 0) {
    pool.push(`У нас уже есть укрытие в ${locationsWithShelter[0]!.name}. Может собраться там?`)
  }
  if (locationsWithoutShelter.length > 2) {
    pool.push(`${other.name}, у нас мало укрытий. Надо построить ещё хотя бы одно.`)
  }

  // Request specific help based on needs
  if (agent.hunger > 50 && other.inventory.some(i => ['food', 'fruit', 'fish', 'shellfish'].includes(i))) {
    pool.push(`${other.name}, у тебя есть еда! Можешь поделиться? Я очень голоден.`)
    pool.push(`Я вижу у тебя ${other.inventory.find(i => ['food', 'fruit', 'fish'].includes(i))}. Не одолжишь? Помираю с голоду...`)
  }
  if (agent.health < 50 && other.inventory.some(i => ['medicine', 'herbs'].includes(i))) {
    pool.push(`${other.name}, у тебя есть ${other.inventory.includes('medicine') ? 'лекарство' : 'травы'}! Помоги, пожалуйста. Мне плохо.`)
  }
  if (!agent.inventory.includes('torch') && input.dayPhase === 'dusk') {
    pool.push(`Скоро ночь, а у меня нет факела... ${other.name}, может скрафтим?`)
  }

  // Offer help
  if (other.health < 50 && agent.inventory.some(i => ['medicine', 'herbs'].includes(i))) {
    pool.push(`${other.name}, я вижу тебе плохо. У меня есть ${agent.inventory.includes('medicine') ? 'лекарство' : 'травы'}. Давай полечу!`)
  }
  if (other.hunger > 60 && agent.inventory.some(i => ['food', 'fruit', 'fish', 'shellfish'].includes(i))) {
    pool.push(`${other.name}, ты голоден? Держи, у меня есть немного еды.`)
  }

  // ═══════ 3. DISCUSS OTHER AGENTS ═══════
  const othersAlive = input.agents.filter(a => a.isAlive && a.id !== agent.id && a.id !== other.id)
  for (const third of othersAlive) {
    const relToThird = getRelation(input.relations, agent.id, third.id)
    if (relToThird.affinity < -0.4) {
      pool.push(`${other.name}, ты заметил как ведёт себя ${third.name}? Мне это не нравится.`)
      pool.push(`Я не доверяю ${third.name}. Надо следить за ${third.role === 'Hunter' ? 'ним' : 'ней'}.`)
    } else if (relToThird.affinity > 0.5) {
      pool.push(`${third.name} — хороший человек. Нам повезло, что ${third.role === 'Hunter' ? 'он' : 'она'} с нами.`)
    }
    if (third.health < 30) {
      pool.push(`${other.name}, ты видел ${third.name}? Выглядит ужасно. Надо помочь.`)
    }
    if (third.locationId !== agent.locationId) {
      const thirdLoc = input.nodesById.get(third.locationId)
      pool.push(`Интересно, что делает ${third.name} в ${thirdLoc?.name ?? 'там'}...`)
    }
  }

  // ═══════ 4. WEATHER & ENVIRONMENT (expanded) ═══════
  if (input.weather === 'storm') {
    pool.push(`${other.name}, этот шторм не утихает! Мы теряем здоровье на открытом месте!`)
    pool.push(`Слышишь этот гром? Нам нельзя оставаться здесь. Бежим в укрытие!`)
    pool.push(`Шторм всё сильнее... Если не найдём укрытие, мы не доживём до утра.`)
    pool.push(`${other.name}, помоги собрать дерево, пока шторм не усилился. Нужно укрытие!`)
  } else if (input.weather === 'rain') {
    pool.push(`Дождь не прекращается... Хоть бы к утру стихло.`)
    pool.push(`${other.name}, дождь — это хорошо! Можно набрать пресной воды.`)
    pool.push(`Под дождём толку мало. Может займёмся крафтом пока пережидаем?`)
  } else if (input.weather === 'fog') {
    pool.push(`В этом тумане ничего не видно. Не уходи далеко, ${other.name}.`)
    pool.push(`Странный туман... Будто остров прячет от нас что-то.`)
    pool.push(`В тумане легко потеряться. Давай держаться рядом.`)
  } else {
    pool.push(`Отличная погода! Надо использовать каждую минуту для работы.`)
    pool.push(`Пока ясно, самое время исследовать новые территории. Пойдёшь со мной?`)
  }

  // ═══════ 5. HUNGER & HEALTH (expanded) ═══════
  if (agent.hunger > 70) {
    pool.push(`${other.name}, я умираю с голоду! У тебя есть хоть что-нибудь поесть?`)
    pool.push(`Мне нужна еда прямо сейчас. Давай вместе пойдём к озеру за рыбой!`)
    pool.push(`Мой желудок бунтует... Если не поем скоро, будет беда.`)
  } else if (agent.hunger > 50) {
    pool.push(`${other.name}, я голоден. Может устроим совместную рыбалку?`)
    pool.push(`Нам бы организовать запасы еды. Одной рыбалкой сыт не будешь.`)
  }
  if (other.hunger > 70) {
    pool.push(`${other.name}, ты совсем ослаб от голода. Давай что-нибудь добудем!`)
  }
  if (agent.health < 40) {
    pool.push(`Мне плохо, ${other.name}... Раны не заживают. Нужны лекарства.`)
    pool.push(`Если бы у нас были травы и вода, можно было бы сделать лекарство...`)
  } else if (agent.health < 65) {
    pool.push(`У меня ещё болит после вчерашнего. Но терпимо.`)
  }
  if (other.health < 40) {
    pool.push(`${other.name}, ты выглядишь ужасно! Тебе срочно нужна помощь!`)
    pool.push(`${other.name}, сядь, отдохни. Я попробую найти для тебя травы.`)
  }

  // ═══════ 6. GOALS & PLANNING (expanded with other's goal) ═══════
  if (agent.goal) {
    pool.push(`Моя цель — ${agent.goal}. ${other.name}, как ты можешь помочь?`)
    pool.push(`Я думаю о том, как: «${agent.goal}». У тебя есть идеи?`)
    pool.push(`Игрок хочет чтобы я ${agent.goal}. Давай вместе это сделаем!`)
  }
  if (other.goal) {
    pool.push(`${other.name}, как продвигается твоя цель — «${other.goal}»?`)
    pool.push(`Я слышал, что ты хочешь ${other.goal}. Могу помочь!`)
  }

  // ═══════ 7. DAY/NIGHT (expanded) ═══════
  if (input.dayPhase === 'night') {
    pool.push(`Ночь... Слышишь эти звуки? Что-то шуршит в кустах.`)
    pool.push(`Давай по очереди караулить. Я посижу первым, ${other.name}.`)
    pool.push(`${other.name}, не засыпай! Ночью хищники выходят на охоту.`)
    pool.push(`Вот бы у нас был костёр... Со светом было бы спокойнее.`)
  } else if (input.dayPhase === 'dawn') {
    pool.push(`Доброе утро, ${other.name}! Пережили ещё одну ночь. Что делаем сегодня?`)
    pool.push(`Рассвет День ${input.day}. Каждый день — это шанс на спасение.`)
    pool.push(`Новый день. Давай составим план: что нам нужно больше всего?`)
  } else if (input.dayPhase === 'dusk') {
    pool.push(`${other.name}, скоро стемнеет. Нам нужно подготовиться к ночи.`)
    pool.push(`Закат... Надо убедиться что у всех есть укрытие или факел.`)
  }

  // ═══════ 8. RELATIONSHIPS (expanded with trust) ═══════
  if (r.affinity > 0.5) {
    pool.push(`${other.name}, ты мой лучший друг на этом острове. Спасибо что ты рядом.`)
    pool.push(`Я рад, что могу на тебя положиться. Вместе мы справимся!`)
    pool.push(`Когда нас спасут, я тебе это не забуду. Обещаю, ${other.name}.`)
    pool.push(`${other.name}, если что-то случится — я прикрою тебя.`)
  } else if (r.affinity > 0.15) {
    pool.push(`${other.name}, нам надо координироваться лучше. Что ты планируешь?`)
    pool.push(`Как дела, ${other.name}? Давненько мы нормально не разговаривали.`)
  } else if (r.affinity > -0.2) {
    pool.push(`${other.name}, ты чем занят? Может вместе что-нибудь сделаем?`)
    pool.push(`Послушай, ${other.name}, нам надо работать вместе. Иначе не выживем.`)
  } else if (r.affinity < -0.3) {
    pool.push(`${other.name}... Нам нужно поговорить. Так дальше нельзя.`)
    pool.push(`Я тебе не доверяю, ${other.name}. Но давай хотя бы не мешать друг другу.`)
    pool.push(`${other.name}, хватит конфликтовать. Мы все умрём если не объединимся.`)
    pool.push(`Мне не нравится что между нами происходит. Давай мириться.`)
  }
  if (r.trust < 0.2) {
    pool.push(`${other.name}, мне сложно тебе доверять после всего... Но я стараюсь.`)
  }

  // ═══════ 9. LOCATION & RESOURCES (expanded) ═══════
  if (loc) {
    const resHere = Object.entries(loc.resources).filter(([, v]) => v > 0)
    if (resHere.length > 0) {
      pool.push(`Здесь есть ${resHere.map(([k, v]) => `${k}(${v})`).join(', ')}. Пригодится!`)
      pool.push(`${other.name}, видишь? Тут ${resHere[0]![0]}! Давай соберём.`)
    }
    if (loc.kind === 'beach') {
      pool.push(`С пляжа видно горизонт... Ни одного корабля. Ни сигнала.`)
      pool.push(`Может сложить из камней знак SOS на пляже? Вдруг кто-то заметит.`)
    }
    if (loc.kind === 'jungle') {
      pool.push(`В джунглях полно ресурсов. Но кто знает что прячется в зарослях.`)
      pool.push(`${other.name}, будь аккуратнее в джунглях. Тут могут быть змеи.`)
    }
    if (loc.kind === 'cave') pool.push(`Пещера — отличное укрытие от шторма. Надо обустроить.`)
    if (loc.kind === 'mountain') pool.push(`С горы видно весь остров. ${other.name}, смотри — вон там дым? Или показалось...`)
    if (loc.kind === 'lake') pool.push(`Пресная вода! Это сокровище. Надо организовать водопой.`)
    if (!loc.shelter) pool.push(`Здесь нет укрытия. ${other.name}, если найдём дерево — построим!`)
    if (loc.shelter) pool.push(`Хорошо что тут есть укрытие. Давай укрепим его.`)
  }

  // Knowledge about other locations
  const nbLocs = neighbors(input.world, agent.locationId).map(id => input.nodesById.get(id)).filter(Boolean)
  for (const nb of nbLocs) {
    if (!nb) continue
    const resNb = Object.entries(nb.resources).filter(([, v]) => v > 0)
    if (resNb.length > 2) {
      pool.push(`${other.name}, в "${nb.name}" полно ресурсов: ${resNb.slice(0, 3).map(([k]) => k).join(', ')}. Стоит сходить!`)
    }
    if (nb.shelter) {
      pool.push(`Кстати, в "${nb.name}" есть укрытие. На случай шторма — пригодится.`)
    }
  }

  // ═══════ 10. INVENTORY & TRADE PROPOSALS ═══════
  if (agent.inventory.length > 0) {
    const item = pick(rnd, agent.inventory)
    pool.push(`У меня есть ${item}. Может обменяемся на что-нибудь?`)
    pool.push(`Смотри: ${agent.inventory.join(', ')}. Что-то нужно, ${other.name}?`)

    // Craft proposals
    const recipes = getCraftRecipes()
    for (const recipe of recipes) {
      const has = recipe.ingredients.filter(i => agent.inventory.includes(i))
      const needs = recipe.ingredients.filter(i => !agent.inventory.includes(i))
      if (has.length > 0 && needs.length > 0 && other.inventory.some(i => needs.includes(i))) {
        pool.push(`${other.name}, у меня есть ${has.join(', ')}, а у тебя ${needs.join(', ')}! Давай вместе скрафтим ${recipe.result}!`)
      }
    }
  }
  if (agent.inventory.length === 0) {
    pool.push(`У меня ничего нет... ${other.name}, можешь чем-нибудь поделиться?`)
  }

  // ═══════ 11. ROLE-SPECIFIC (expanded) ═══════
  if (agent.role === 'Leader') {
    pool.push(`Команда, слушайте! ${other.name}, нам нужен план на сегодня.`)
    pool.push(`Как лидер, я предлагаю: ${other.role === 'Hunter' ? 'ты ищи еду' : other.role === 'Builder' ? 'ты строй укрытие' : other.role === 'Medic' ? 'ты следи за здоровьем' : 'ты разведай территорию'}.`)
    pool.push(`${other.name}, доложи обстановку. Что ты нашёл? Что видел?`)
  }
  if (agent.role === 'Scout') {
    pool.push(`Я обследовал ${loc?.name ?? 'это место'}. Есть кое-что интересное.`)
    pool.push(`${other.name}, я нашёл тропинку. Может ведёт к чему-то ценному!`)
    pool.push(`Разведка показала — рядом ${nbLocs.length} доступных локаций. Куда идём?`)
  }
  if (agent.role === 'Medic') {
    pool.push(`${other.name}, как самочувствие? HP: ${other.health}. ${other.health < 70 ? 'Тебе нужна помощь!' : 'Выглядишь нормально.'}`)
    pool.push(`Мне нужны травы и вода для лекарств. Кто-нибудь видел травы?`)
    pool.push(`Как медик, я слежу за всеми. ${othersAlive.find(a => a.health < 50) ? `${othersAlive.find(a => a.health < 50)!.name} в плохом состоянии!` : 'Пока все живы.'}`)
  }
  if (agent.role === 'Builder') {
    pool.push(`Мне нужно дерево и камень. ${other.name}, поможешь собрать?`)
    pool.push(`Я могу построить ${loc?.shelter ? 'что-нибудь ещё' : 'укрытие здесь'}. Нужны материалы!`)
    pool.push(`${other.name}, давай вместе построим что-нибудь полезное.`)
  }
  if (agent.role === 'Hunter') {
    pool.push(`Я чую добычу рядом. ${other.name}, хочешь присоединиться к охоте?`)
    pool.push(`Группе нужна еда. Я пойду на рыбалку к озеру. Кто со мной?`)
    pool.push(`${other.name}, покрой мне спину, я разведаю вон те заросли.`)
  }

  // ═══════ 12. EMOTIONAL & PHILOSOPHICAL (expanded) ═══════
  pool.push(`День ${input.day} на острове... Время летит. Или тянется. Я уже не понимаю.`)
  pool.push(`${other.name}, как думаешь — нас ищут? Или уже списали?`)
  pool.push(`До кораблекрушения моя жизнь была совсем другой. Скучаю по дому...`)
  pool.push(`Знаешь, ${other.name}, этот остров меняет людей. Я это вижу.`)
  pool.push(`Мне кажется, на этом острове что-то не так. Странные звуки по ночам...`)
  pool.push(`${other.name}, если мы выберемся отсюда — первым делом я наемся досыта!`)
  pool.push(`Иногда думаю: может это и есть наш новый дом? На всю жизнь?`)
  pool.push(`${other.name}, давай договоримся — если один из нас не выживет, другой расскажет о нём.`)

  // ═══════ 13. MEMORY-BASED (reference past events from memory) ═══════
  if (input.memoryHits.length > 0) {
    const mem = pick(rnd, input.memoryHits)
    if (mem && mem.entry.text.length > 10) {
      const memText = mem.entry.text.slice(0, 60)
      pool.push(`${other.name}, помнишь? ${memText}... Это было непросто.`)
      pool.push(`Мне вспомнилось: ${memText}. Главное — не повторять ошибок.`)
    }
  }

  // ═══════ 14. REACTIONS TO BEAST FIGHTS & CHALLENGES ═══════
  const recentBeastFights = recentEvents.filter(e => e.type === 'beast_fight')
  for (const bf of recentBeastFights) {
    if (bf.title.includes('ПОБЕДИЛ')) {
      const heroName = bf.title.replace(/[⚔️🐻\s]+/g, '').split('ПОБЕДИЛ')[0]?.trim()
      pool.push(`${other.name}, ты видел как ${heroName ?? 'кто-то'} победил хищника?! Невероятно!`)
      pool.push(`Этот бой с хищником... ${heroName ?? 'Герой'} спас нам жизнь! Я теперь в долгу.`)
      pool.push(`После атаки зверя нам нужно быть осторожнее. Надо выставить караул, ${other.name}!`)
      pool.push(`${heroName ?? 'Победитель'} — настоящий боец! Без него мы бы не справились.`)
    } else if (bf.title.includes('свирепствует')) {
      pool.push(`${other.name}, этот зверь чуть нас не убил! Нужно оружие!`)
      pool.push(`Мы едва выжили после атаки хищника... Нужны ножи и факелы!`)
      pool.push(`Больше я без оружия никуда не пойду. ${other.name}, давай скрафтим ножи?`)
    }
  }

  const recentChallengeResults = recentEvents.filter(e => e.type === 'challenge_result')
  for (const cr of recentChallengeResults) {
    pool.push(`${other.name}, ты в порядке после ${cr.title}?`)
    pool.push(`После этого испытания нам нужно восстановиться. Давай найдём укрытие!`)
    pool.push(`Остров нас не щадит... ${cr.text.slice(0, 50)}. Но мы выдержим!`)
    if (cr.title.includes('РАЗРУШЕНО') || cr.title.includes('СГОРЕЛО')) {
      pool.push(`Укрытие уничтожено! ${other.name}, нам срочно нужно построить новое!`)
      pool.push(`Без укрытия мы не переживём следующий шторм. Помоги собрать дерево!`)
    }
  }

  const recentHeroic = recentEvents.filter(e => e.type === 'heroic')
  for (const h of recentHeroic) {
    pool.push(`${h.title}! Вот это поступок! ${other.name}, ты знала об этом?`)
    pool.push(`Настоящий герой среди нас... ${h.text.slice(0, 60)}`)
  }

  const recentAlliances = recentEvents.filter(e => e.type === 'alliance')
  for (const al of recentAlliances) {
    if (!al.participants?.includes(agent.id)) {
      pool.push(`${other.name}, слышал? ${al.title}! Может нам тоже стоит объединиться?`)
    } else {
      pool.push(`${other.name}, наш альянс — лучшее что случилось на этом острове!`)
    }
  }

  const recentDiscoveries = recentEvents.filter(e => e.type === 'discovery')
  for (const d of recentDiscoveries) {
    pool.push(`${other.name}, ты слышал? ${d.text.slice(0, 60)}! Надо это проверить!`)
    pool.push(`Интересная находка: ${d.title}. На острове полно тайн!`)
  }

  // ═══════ 15. STRATEGY & TACTICS ═══════
  pool.push(`${other.name}, нам нужна стратегия. Кто караулит ночью, кто добывает еду?`)
  pool.push(`Предлагаю: утром — сбор ресурсов, днём — стройка, вечером — готовимся к ночи.`)
  pool.push(`${other.name}, может расставим ловушки вокруг лагеря? Хищники повсюду!`)
  pool.push(`У нас должен быть план эвакуации! Если шторм — все бегут в пещеру, договорились?`)
  pool.push(`${other.name}, давай организуем дежурство. Нельзя чтобы все спали одновременно.`)
  if (input.day > 3) {
    pool.push(`Уже ${input.day}-й день. Если нас не найдут скоро, надо строить плот...`)
    pool.push(`${other.name}, может стоит разжечь сигнальный костёр на вершине горы?`)
  }

  // ═══════ 16. PERSONAL BACKSTORIES ═══════
  const backstories: Record<string, string[]> = {
    Leader: [
      `До кораблекрушения я управлял командой. Привык нести ответственность.`,
      `У меня дома семья... Они, наверное, с ума сходят.`,
      `Я всегда мечтал о приключениях. Но не таких.`,
    ],
    Scout: [
      `Я с детства лазил по горам. Исследование — моя стихия!`,
      `В прошлой жизни я был фотографом дикой природы. Ирония судьбы...`,
      `Мне нравится быть один. Но не так надолго.`,
    ],
    Medic: [
      `Я училась на врача. Никогда не думала, что придётся лечить травами.`,
      `Моя мама была травницей. Наконец-то пригодились её уроки.`,
      `Каждая потерянная жизнь — это мой провал. Я не могу этого допустить.`,
    ],
    Builder: [
      `Я работал на стройке. Руки помнят, как держать инструмент.`,
      `Мой дед строил дома. Он бы гордился этим укрытием.`,
      `Я не люблю говорить, но руками могу многое.`,
    ],
    Hunter: [
      `Охота — это искусство. Терпение, тишина, точный удар.`,
      `В армии я был снайпером. Теперь охочусь на рыбу...`,
      `Мне не нравится убивать. Но еда нужна всем.`,
    ],
  }
  const myStories = backstories[agent.role] ?? []
  for (const s of myStories) {
    pool.push(`${other.name}... ${s}`)
  }

  // ═══════ 17. SECRETS & RUMORS ═══════
  pool.push(`${other.name}, я слышал странные звуки из пещеры прошлой ночью...`)
  pool.push(`Знаешь, я нашёл странные символы на скале. Кто-то был здесь до нас.`)
  pool.push(`${other.name}, мне кажется, этот остров не так прост. Здесь что-то скрыто.`)
  pool.push(`Я видел свет в джунглях ночью. Там кто-то есть... или что-то.`)
  pool.push(`${other.name}, не говори никому, но я нашёл странный предмет. Не знаю что это.`)
  pool.push(`Мне снился один и тот же сон: мы все стоим у обрыва... это знак.`)
  pool.push(`${other.name}, ты заметил? Некоторые деревья тут растут в форме стрелок. Куда они указывают?`)

  // ═══════ 18. CONFLICTS & ARGUMENTS ═══════
  if (r.affinity < -0.1) {
    pool.push(`${other.name}, хватит! Из-за тебя мы потеряли время! Надо было идти к озеру!`)
    pool.push(`Я не согласен с тобой, ${other.name}. Твой план — самоубийство!`)
    pool.push(`Кто назначил тебя главным? ${other.name}, у каждого свой голос!`)
  }
  if (input.agents.filter(a => a.isAlive).length <= 3) {
    pool.push(`Нас осталось мало... ${other.name}, нельзя больше ссориться. Мы одна команда.`)
    pool.push(`Каждый из нас на счету. ${other.name}, забудем обиды?`)
  }
  // Resource conflicts
  if (agent.hunger > 60 && other.inventory.length > 3) {
    pool.push(`${other.name}, ты копишь ресурсы! Поделись с остальными! Люди голодают!`)
  }

  // ═══════ 19. HUMOR & MORALE ═══════
  pool.push(`${other.name}, знаешь анекдот? Два робинзона на острове... А, ну мы и есть робинзоны.`)
  pool.push(`Зато здесь нет интернета — можно наконец-то выспаться! ...если бы не хищники.`)
  pool.push(`${other.name}, когда нас спасут, я напишу книгу: "Как выжить с ${input.agents.filter(a => a.isAlive).length} безумцами на острове"`)
  pool.push(`Хей ${other.name}, смотри на это оптимистично — бесплатный отпуск на тропическом острове!`)
  pool.push(`${other.name}, а ведь мы могли бы стать звёздами реалити-шоу! "Выжить любой ценой"!`)
  pool.push(`Знаешь что, ${other.name}? Я начинаю привыкать к этому месту. Страшно, правда?`)
  if (agent.hunger < 20 && agent.health > 70) {
    pool.push(`${other.name}, жизнь налаживается! Сыт, здоров — почти как дома!`)
  }

  // ═══════ 20. ALLIANCE PROPOSALS ═══════
  if (r.affinity > 0.3 && r.trust > 0.25) {
    pool.push(`${other.name}, давай держаться вместе? Вдвоём проще выжить.`)
    pool.push(`Я тебе доверяю, ${other.name}. Предлагаю альянс — будем прикрывать друг друга.`)
    pool.push(`${other.name}, если что-то пойдёт не так — я на твоей стороне. Запомни это.`)
  } else if (r.affinity > 0) {
    pool.push(`${other.name}, мы не так близки, но на этом острове важен каждый. Давай сотрудничать.`)
  }

  // ═══════ 21. SURVIVAL SKILLS SHARING ═══════
  const bestSkill = Object.entries(agent.skills).sort((a, b) => b[1].level - a[1].level)[0]
  if (bestSkill && bestSkill[1].level >= 2) {
    const skillNameRu: Record<string, string> = { gathering: 'сбор ресурсов', crafting: 'крафт', combat: 'бой', medicine: 'медицина', building: 'строительство' }
    pool.push(`${other.name}, я прокачал ${skillNameRu[bestSkill[0]] ?? bestSkill[0]} до Лв${bestSkill[1].level}! Могу научить.`)
    pool.push(`С моим уровнем ${skillNameRu[bestSkill[0]] ?? bestSkill[0]} я могу ${bestSkill[0] === 'combat' ? 'защитить нас от хищников' : bestSkill[0] === 'gathering' ? 'добыть больше ресурсов' : bestSkill[0] === 'medicine' ? 'вылечить раненых' : 'построить что-нибудь полезное'}.`)
  }

  return pick(rnd, pool)
}

/** ★ Extract player directive from recent events and goal to make agent responsive */
function extractPlayerDirective(input: DecideActionInput): AgentAction | null {
  const agent = input.agent
  const rnd = mulberry32(Date.now() + 7)
  const here = agent.locationId
  const loc = input.nodesById.get(here)

  // Check for recent player messages or goal changes directed at this agent
  const recentPlayerEvents = input.recentFeed.filter(e =>
    e.participants?.includes(agent.id) &&
    (e.type === 'goal' || (e.type === 'message' && e.title.includes('Голос свыше')) || (e.type === 'world' && e.title.includes('Испытание')) || e.type === 'beast_fight' || e.type === 'challenge_result' || e.type === 'heroic' || e.type === 'discovery')
  )

  if (recentPlayerEvents.length === 0) return null

  const latest = recentPlayerEvents[recentPlayerEvents.length - 1]!
  const txt = (latest.text + ' ' + agent.goal).toLowerCase()

  // Keyword-based intent: try to match player's intent to an action
  if (txt.includes('строй') || txt.includes('укрытие') || txt.includes('shelter') || txt.includes('построй')) {
    if (agent.inventory.includes('wood') && loc && !loc.shelter) return { type: 'build' }
    if (loc && !loc.shelter) {
      const res = loc.resources['wood'] ?? 0
      if (res > 0) return { type: 'gather', resource: 'wood' }
    }
  }

  if (txt.includes('лечи') || txt.includes('heal') || txt.includes('исцел') || txt.includes('помоги')) {
    const wounded = input.agents.filter(a => a.locationId === here && a.health < 70 && a.id !== agent.id && a.isAlive)
    if (wounded.length && (agent.inventory.includes('medicine') || agent.inventory.includes('herbs'))) {
      return { type: 'heal', target: wounded[0]!.id }
    }
  }

  if (txt.includes('исследуй') || txt.includes('разведай') || txt.includes('explore') || txt.includes('найди')) {
    return { type: 'explore' }
  }

  if (txt.includes('крафт') || txt.includes('создай') || txt.includes('сделай') || txt.includes('craft')) {
    const recipes = getCraftRecipes()
    for (const recipe of recipes) {
      if (txt.includes(recipe.result) && recipe.ingredients.every(i => agent.inventory.includes(i))) {
        return { type: 'craft', item: recipe.result }
      }
    }
    // Try to craft anything available
    for (const recipe of recipes) {
      if (recipe.ingredients.every(i => agent.inventory.includes(i))) return { type: 'craft', item: recipe.result }
    }
  }

  if (txt.includes('собирай') || txt.includes('добудь') || txt.includes('ресурс') || txt.includes('gather')) {
    const res = loc ? Object.entries(loc.resources).filter(([, v]) => v > 0) : []
    if (res.length) return { type: 'gather', resource: res[0]![0] }
  }

  if (txt.includes('ешь') || txt.includes('еда') || txt.includes('поешь') || txt.includes('eat')) {
    const food = agent.inventory.find(i => ['food', 'fruit', 'fish', 'shellfish'].includes(i))
    if (food) return { type: 'eat', item: food }
  }

  if (txt.includes('иди') || txt.includes('двигайся') || txt.includes('move') || txt.includes('перемест')) {
    const nbs = neighbors(input.world, here)
    // Try to find target location
    for (const nid of nbs) {
      const n = input.nodesById.get(nid)
      if (n && txt.includes(n.name.toLowerCase())) return { type: 'move', to: nid }
    }
    if (nbs.length) return { type: 'move', to: pick(rnd, nbs) }
  }

  if (txt.includes('атак') || txt.includes('бей') || txt.includes('нападай') || txt.includes('attack') || txt.includes('хищник') || txt.includes('зверь')) {
    const enemies = input.agents.filter(a => a.locationId === here && a.id !== agent.id && a.isAlive)
    const worst = enemies.sort((a, b) => {
      const ra = getRelation(input.relations, agent.id, a.id).affinity
      const rb = getRelation(input.relations, agent.id, b.id).affinity
      return ra - rb
    })[0]
    if (worst) return { type: 'attack', target: worst.id }
  }

  if (txt.includes('торгуй') || txt.includes('отдай') || txt.includes('trade') || txt.includes('передай')) {
    const others = input.agents.filter(a => a.locationId === here && a.id !== agent.id && a.isAlive)
    if (others.length && agent.inventory.length > 0) {
      return { type: 'trade', to: others[0]!.id, item: agent.inventory[0]! }
    }
  }

  if (txt.includes('отдыхай') || txt.includes('rest') || txt.includes('отдохни')) {
    return { type: 'rest' }
  }

  // ★ Reactive behavior for beast fights and challenges
  if (latest.type === 'beast_fight' || latest.type === 'challenge_result') {
    // If wounded, prioritize healing
    if (agent.health < 40) {
      if (agent.inventory.includes('medicine') || agent.inventory.includes('herbs')) {
        return { type: 'heal', target: agent.id }
      }
      // Flee to a neighbor if critically low
      if (agent.health < 20) {
        const nbs = neighbors(input.world, here)
        if (nbs.length) return { type: 'move', to: pick(rnd, nbs) }
      }
    }
    // If others are wounded, help them (medics prioritize this)
    const wounded = input.agents.filter(a => a.locationId === here && a.health < 50 && a.id !== agent.id && a.isAlive)
    if (wounded.length && (agent.inventory.includes('medicine') || agent.inventory.includes('herbs'))) {
      const mostWounded = wounded.sort((a, b) => a.health - b.health)[0]!
      return { type: 'heal', target: mostWounded.id }
    }
    // If shelter was destroyed, gather wood to rebuild
    if (loc && !loc.shelter && (latest.text.includes('РАЗРУШЕНО') || latest.text.includes('СГОРЕЛО'))) {
      const wood = loc.resources['wood'] ?? 0
      if (agent.inventory.includes('wood')) return { type: 'build' }
      if (wood > 0) return { type: 'gather', resource: 'wood' }
    }
    // Talk about what happened
    const othersHere = input.agents.filter(a => a.locationId === here && a.id !== agent.id && a.isAlive)
    if (othersHere.length > 0) {
      return { type: 'message', to: othersHere[0]!.id, text: `Ты в порядке? ${latest.title} — это было жестко!` }
    }
  }

  // ★ React to discoveries by exploring
  if (latest.type === 'discovery') {
    return { type: 'explore' }
  }

  // Default: try to do something relevant to goal
  return null
}

function locName(input: DecideActionInput, id: string) {
  return input.nodesById.get(id)?.name ?? id
}

function systemPrompt(agent: AgentState, input: DecideActionInput) {
  const roleHint: Record<AgentRole, string> = {
    Leader: 'Ты лидер: координируй группу, распределяй задачи.',
    Scout: 'Ты разведчик: исследуй остров, находи ресурсы.',
    Medic: 'Ты медик: лечи раненых, собирай травы.',
    Builder: 'Ты строитель: строй укрытия, создавай инструменты.',
    Hunter: 'Ты охотник: добывай еду, защищай группу.',
  }

  // Find recent player directives
  const playerGoalChanged = input.recentFeed.some(e => e.type === 'goal' && e.participants?.includes(agent.id))
  const playerMessage = input.recentFeed.filter(e => e.type === 'message' && e.title.includes('Голос свыше') && e.participants?.includes(agent.id)).slice(-1)[0]
  const playerChallenge = input.recentFeed.filter(e => (e.type === 'world' && e.title.includes('Испытание') || e.type === 'challenge_result') && e.participants?.includes(agent.id)).slice(-1)[0]
  const recentBeast = input.recentFeed.filter(e => e.type === 'beast_fight' && e.participants?.includes(agent.id)).slice(-1)[0]
  const recentHeroic = input.recentFeed.filter(e => e.type === 'heroic' && e.participants?.includes(agent.id)).slice(-1)[0]
  const recentAlliance = input.recentFeed.filter(e => e.type === 'alliance' && e.participants?.includes(agent.id)).slice(-1)[0]
  const recentDiscovery = input.recentFeed.filter(e => e.type === 'discovery' && e.participants?.includes(agent.id)).slice(-1)[0]

  const lines = [
    'Ты один из 5 выживших на необитаемом острове после кораблекрушения.',
    `Имя: ${agent.name}. Роль: ${agent.role}. ${agent.emoji}`,
    `HP: ${agent.health}/100. Голод: ${agent.hunger}/100.${agent.hunger > 70 ? ' ⚠️ КРИТИЧЕСКИЙ ГОЛОД!' : ''}${agent.health < 30 ? ' ⚠️ КРИТИЧЕСКОЕ ЗДОРОВЬЕ!' : ''}`,
    `Инвентарь: [${agent.inventory.join(', ') || 'пусто'}]`,
    `${agent.profile.personality}`,
    roleHint[agent.role],
    '',
  ]

  // ★★★ CRITICAL: Player directive injection ★★★
  if (playerGoalChanged || playerMessage || playerChallenge || recentBeast || recentHeroic || recentAlliance || recentDiscovery) {
    lines.push('═══════ ⚠️ ПРИКАЗ ИГРОКА — АБСОЛЮТНЫЙ ПРИОРИТЕТ ═══════')
    if (playerGoalChanged) lines.push(`🎯 ИГРОК ЗАДАЛ ТЕБЕ НОВУЮ ЦЕЛЬ: "${agent.goal}"`)
    if (playerMessage) lines.push(`📡 СООБЩЕНИЕ ОТ ИГРОКА: "${playerMessage.text}"`)
    if (playerChallenge) lines.push(`⚡ ИСПЫТАНИЕ НА ЛОКАЦИИ: "${playerChallenge.text}"`)
    if (recentBeast) lines.push(`🐻 ЗВЕРЬ НА ЛОКАЦИИ: "${recentBeast.text}" — РЕАГИРУЙ НА ЭТО В РАЗГОВОРАХ!`)
    if (recentHeroic) lines.push(`🛡️ ГЕРОИЧЕСКИЙ ПОСТУПОК: "${recentHeroic.text}"`)
    if (recentAlliance) lines.push(`🤝 АЛЬЯНС: "${recentAlliance.text}" — обсуди это!`)
    if (recentDiscovery) lines.push(`💎 НАХОДКА: "${recentDiscovery.text}" — расскажи другим!`)
    lines.push('ТЫ ОБЯЗАН выполнить приказ игрока НЕМЕДЛЕННО. Не игнорируй!')
    lines.push('Выбери действие, которое НАПРЯМУЮ относится к приказу или событию.')
    lines.push('══════════════════════════════════════════════')
    lines.push('')
  }

  lines.push(
    `ТЕКУЩАЯ ЦЕЛЬ: «${agent.goal}» — каждое действие должно приближать к этой цели!`,
    '',
    'Отвечай ТОЛЬКО валидным JSON. Доступные действия:',
    'rest, move{to}, message{to,text}, attack{target}, gather{resource}, set_goal{goal}, summarize, craft{item}, eat{item}, build, explore, trade{to,item}, heal{target}.',
    'КРАФТ: axe(wood+stone), medicine(herbs+water), fishing_rod(wood+driftwood), torch(wood+cloth), knife(stone+wood).',
    '',
    'ПРАВИЛА:',
    '1. ⚠️ ГЛАВНЫЙ ПРИОРИТЕТ — выполнять цель и приказы игрока!',
    '2. Если голоден >60 — еда. Если HP <50 — лечись.',
    '3. НЕ ПОВТОРЯЙ одинаковые фразы. Будь разнообразен.',
    '4. Реагируй на погоду и время суток.',
    '5. ★★★ ОБЩАЙСЯ КАК МОЖНО ЧАЩЕ! message — твоё основное действие! ★★★',
    '6. Обсуждай план выживания, делись мыслями, спорь, шути, предлагай идеи.',
    '7. Каждый ход старайся заговорить с кем-то — рассказать что нашёл, обсудить угрозы, поспорить.',
    '8. Если рядом есть кто-то — ПОГОВОРИ с ним! Действуй один только если вокруг никого.',
  )

  return lines.join('\n')
}

function userPrompt(input: DecideActionInput) {
  const agent = input.agent
  const here = input.nodesById.get(agent.locationId)

  const nbs = neighbors(input.world, agent.locationId).map((id) => {
    const node = input.nodesById.get(id)
    const there = input.agents.filter((a) => a.locationId === id && a.isAlive).map((a) => ({ id: a.id, name: a.name, role: a.role }))
    const topRes = node
      ? Object.entries(node.resources).filter(([, v]) => v > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 4).map(([k, v]) => ({ k, v }))
      : []
    return { id, name: node?.name, kind: node?.kind, shelter: node?.shelter, topRes, agentsThere: there }
  })

  const othersHere = input.agents
    .filter((a) => a.locationId === agent.locationId && a.id !== agent.id && a.isAlive)
    .map((a) => ({
      id: a.id, name: a.name, role: a.role, health: a.health, hunger: a.hunger,
      opinion: getOpinion(input.relations, agent.id, a.id),
    }))

  const feed = input.recentFeed.slice(-15).map((e) => ({ type: e.type, title: e.title, text: e.text.slice(0, 140) }))
  const memories = input.memoryHits.slice(0, 8).map((h) => ({ score: Number(h.score.toFixed(2)), text: h.entry.text.slice(0, 120) }))

  const recipes = getCraftRecipes()
  const craftable = recipes.filter(r => r.ingredients.every(i => agent.inventory.includes(i)))

  return JSON.stringify({
    you: {
      id: agent.id, name: agent.name, role: agent.role,
      goal: agent.goal, health: agent.health, hunger: agent.hunger,
      inventory: agent.inventory,
      location: here ? { id: here.id, name: here.name, kind: here.kind, resources: here.resources, shelter: here.shelter } : { id: agent.locationId },
    },
    env: { day: input.day, phase: input.dayPhase, weather: input.weather },
    neighbors: nbs,
    othersHere,
    events: feed,
    memories,
    craftable: craftable.map(r => ({ item: r.result, desc: r.desc })),
    candidates: buildCandidates(input),
  }, null, 1)
}

function buildCandidates(input: DecideActionInput) {
  const out: AgentAction[] = []
  const here = input.agent.locationId
  const loc = input.nodesById.get(here)

  const food = input.agent.inventory.find(i => ['food', 'fruit', 'fish', 'shellfish'].includes(i))
  if (food && input.agent.hunger > 30) out.push({ type: 'eat', item: food })

  const recipes = getCraftRecipes()
  for (const recipe of recipes) {
    if (recipe.ingredients.every(i => input.agent.inventory.includes(i))) out.push({ type: 'craft', item: recipe.result })
  }

  if (loc && !loc.shelter && input.agent.inventory.includes('wood')) out.push({ type: 'build' })
  if (input.memoryCount >= 180) out.push({ type: 'summarize' })

  const res = loc ? Object.entries(loc.resources).filter(([, v]) => v > 0) : []
  if (res.length) out.push({ type: 'gather', resource: res.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]![0] })

  const othersHere = input.agents.filter((a) => a.locationId === here && a.id !== input.agent.id && a.isAlive)
  for (const other of othersHere) {
    const r = getRelation(input.relations, input.agent.id, other.id)
    if (r.affinity <= -0.55) out.push({ type: 'attack', target: other.id })
    if (other.health < 60 && (input.agent.inventory.includes('medicine') || input.agent.inventory.includes('herbs'))) {
      out.push({ type: 'heal', target: other.id })
    }
  }

  out.push({ type: 'explore' })

  // ★ Add MESSAGE candidates to encourage communication
  for (const other of othersHere) {
    out.push({ type: 'message', to: other.id, text: `Обсудить ситуацию с ${input.agents.find(a => a.id === other.id)?.name ?? 'кем-то'}` })
  }

  const nbs = neighbors(input.world, here)
  if (nbs.length) out.push({ type: 'move', to: pick(mulberry32(Date.now() + 13), nbs) })
  out.push({ type: 'rest' })
  return out.slice(0, 14)
}
