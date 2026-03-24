import { nanoid } from 'nanoid'
import type { LocationId, LocationKind, LocationNode, WorldGraph } from './types.js'
import { mulberry32, pick } from './rng.js'

export function seedWorld(seed = 1337): WorldGraph {
  const rnd = mulberry32(seed)
  const width = 600
  const height = 400

  // Hand-crafted island locations — ALL on land, positioned carefully
  const locations: Array<{ name: string; kind: LocationKind; x: number; y: number; res: Record<string, number> }> = [
    // Camp (center of island)
    { name: 'Базовый лагерь', kind: 'camp', x: 300, y: 200, res: { wood: 2, food: 2 } },
    // Beaches (on the shore but still on island landmass)
    { name: 'Песчаный берег', kind: 'beach', x: 180, y: 310, res: { fish: 4, driftwood: 3 } },
    { name: 'Коралловая бухта', kind: 'beach', x: 430, y: 300, res: { fish: 5, shellfish: 2 } },
    { name: 'Скалистый утёс', kind: 'beach', x: 450, y: 170, res: { fish: 2, stone: 2 } },
    // Jungle (central green areas)
    { name: 'Густые джунгли', kind: 'jungle', x: 220, y: 150, res: { fruit: 5, wood: 4, herbs: 3 } },
    { name: 'Бамбуковая роща', kind: 'jungle', x: 380, y: 130, res: { wood: 5, fruit: 3 } },
    { name: 'Тропа лиан', kind: 'jungle', x: 200, y: 240, res: { fruit: 3, herbs: 2, wood: 2 } },
    // Mountain (upper center)
    { name: 'Горный пик', kind: 'mountain', x: 300, y: 80, res: { stone: 5, ore: 3 } },
    { name: 'Каменный склон', kind: 'mountain', x: 400, y: 95, res: { stone: 4, ore: 2 } },
    // Cave (inside the island)
    { name: 'Тёмная пещера', kind: 'cave', x: 170, y: 110, res: { gems: 2, ore: 2 } },
    { name: 'Грот водопада', kind: 'cave', x: 410, y: 230, res: { water: 4, gems: 1 } },
    // Lake (center-south)
    { name: 'Лесное озеро', kind: 'lake', x: 280, y: 270, res: { water: 6, fish: 3 } },
    { name: 'Горный ручей', kind: 'lake', x: 360, y: 210, res: { water: 5, fish: 2 } },
    // Extra
    { name: 'Старый маяк', kind: 'beach', x: 140, y: 200, res: { driftwood: 2, cloth: 1 } },
  ]

  const nodes: LocationNode[] = locations.map((loc) => ({
    id: nanoid(8),
    name: loc.name,
    x: loc.x,
    y: loc.y,
    kind: loc.kind,
    resources: { ...loc.res },
    shelter: loc.kind === 'camp',
    chest: [],
  }))

  const edges: Array<{ a: LocationId; b: LocationId }> = []
  const id = (i: number) => nodes[i]!.id

  // Main ring
  const mainPath = [0, 4, 7, 5, 8, 3, 10, 12, 2, 11, 6, 1, 13, 0]
  for (let i = 0; i < mainPath.length - 1; i++) {
    edges.push({ a: id(mainPath[i]!), b: id(mainPath[i + 1]!) })
  }
  // Cross-paths
  edges.push({ a: id(0), b: id(11) })
  edges.push({ a: id(0), b: id(12) })
  edges.push({ a: id(4), b: id(6) })
  edges.push({ a: id(5), b: id(12) })
  edges.push({ a: id(7), b: id(9) })
  edges.push({ a: id(9), b: id(4) })
  edges.push({ a: id(1), b: id(11) })

  const dedup = new Set<string>()
  const finalEdges: typeof edges = []
  for (const e of edges) {
    const key = [e.a, e.b].sort().join(':')
    if (dedup.has(key)) continue
    dedup.add(key)
    finalEdges.push(e)
  }

  return { seed, width, height, nodes, edges: finalEdges }
}

export function neighbors(world: WorldGraph, id: LocationId) {
  const out: LocationId[] = []
  for (const e of world.edges) {
    if (e.a === id) out.push(e.b)
    else if (e.b === id) out.push(e.a)
  }
  return out
}
