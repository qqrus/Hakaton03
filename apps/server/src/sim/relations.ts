import type { AgentId, Relation } from './types.js'
import { clamp } from './rng.js'

export function getRelation(relations: Relation[], a: AgentId, b: AgentId) {
  const [x, y] = a < b ? [a, b] : [b, a]
  let r = relations.find((t) => t.a === x && t.b === y)
  if (!r) {
    r = { a: x, b: y, affinity: 0.1, trust: 0.5 } // start slightly positive (fellow survivors)
    relations.push(r)
  }
  return r
}

export function bumpRelation(relations: Relation[], a: AgentId, b: AgentId, dAffinity: number, dTrust: number) {
  const r = getRelation(relations, a, b)
  r.affinity = clamp(r.affinity + dAffinity, -1, 1)
  r.trust = clamp(r.trust + dTrust, 0, 1)
  return r
}

export function getOpinion(relations: Relation[], selfId: AgentId, targetId: AgentId): string {
  const r = getRelation(relations, selfId, targetId)
  const aff = r.affinity
  const tr = r.trust

  if (aff > 0.7 && tr > 0.7) return 'спаситель'
  if (aff > 0.5 && tr > 0.5) return 'надёжный товарищ'
  if (aff > 0.25) return 'попутчик'
  if (aff > 0.05) return 'знакомый'
  if (aff < -0.6) return 'предатель'
  if (aff < -0.3) return 'ненадёжный тип'
  if (tr < 0.2) return 'подозрительный'
  return 'нейтрально'
}
