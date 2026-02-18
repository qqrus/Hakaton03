export type AgentId = string
export type LocationId = string

export type Mood = { valence: number; arousal: number }

export type AgentRole = 'Scout' | 'Medic' | 'Builder' | 'Hunter' | 'Leader'

export type AgentState = {
  id: AgentId
  name: string
  role: AgentRole
  avatarSeed: string
  emoji: string
  traits: {
    empathy: number
    aggression: number
    resourcefulness: number
    endurance: number
    curiosity: number
  }
  profile: {
    personality: string
    constraints: string[]
    priorities: string[]
  }
  locationId: LocationId
  mood: Mood
  goal: string
  health: number
  hunger: number
  inventory: string[]
  isAlive: boolean
  lastActionAt: number
  skills: {
    gathering: { level: number; xp: number }
    crafting: { level: number; xp: number }
    combat: { level: number; xp: number }
    medicine: { level: number; xp: number }
    building: { level: number; xp: number }
  }
  lastThought: string
  deathLog?: {
    cause: string
    day: number
    survivalTime: number
    totalActions: number
  }
}

export type LocationKind = 'beach' | 'jungle' | 'mountain' | 'cave' | 'lake' | 'camp'

export type LocationNode = {
  id: LocationId
  name: string
  x: number
  y: number
  kind: LocationKind
  resources: Record<string, number>
  shelter: boolean
  chest: string[]
}

export type WorldGraph = {
  seed: number
  width: number
  height: number
  nodes: LocationNode[]
  edges: Array<{ a: LocationId; b: LocationId }>
}

export type Relation = { a: AgentId; b: AgentId; affinity: number; trust: number }

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type Weather = 'clear' | 'rain' | 'storm' | 'fog'

export type WorldEventType =
  | 'world'
  | 'move'
  | 'message'
  | 'attack'
  | 'gather'
  | 'rest'
  | 'goal'
  | 'summarize'
  | 'craft'
  | 'eat'
  | 'build'
  | 'explore'
  | 'trade'
  | 'heal'
  | 'death'
  | 'weather'
  | 'night'
  | 'beast_fight'
  | 'challenge_result'
  | 'alliance'
  | 'discovery'
  | 'heroic'

export type EventEnvelope = {
  id: string
  ts: number
  type: WorldEventType
  title: string
  text: string
  locationId?: LocationId
  participants?: AgentId[]
  importance: number
}

export type WorldState = {
  now: number
  speed: number
  tick: number
  day: number
  dayPhase: DayPhase
  weather: Weather
  world: WorldGraph
  agents: AgentState[]
  relations: Relation[]
  feed: EventEnvelope[]
}
