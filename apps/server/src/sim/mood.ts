import type { Mood, WorldEventType } from './types.js'
import { clamp } from './rng.js'

export function applyEventToMood(mood: Mood, type: WorldEventType, importance: number) {
  const k = clamp(importance, 0, 1)
  if (type === 'attack') return bump(mood, -0.35 * k, 0.5 * k)
  if (type === 'death') return bump(mood, -0.6 * k, 0.4 * k)
  if (type === 'message') return bump(mood, 0.08 * k, 0.05 * k)
  if (type === 'gather') return bump(mood, 0.15 * k, 0.1 * k)
  if (type === 'craft') return bump(mood, 0.22 * k, 0.12 * k)
  if (type === 'eat') return bump(mood, 0.3 * k, -0.1 * k)
  if (type === 'build') return bump(mood, 0.25 * k, 0.08 * k)
  if (type === 'heal') return bump(mood, 0.35 * k, -0.05 * k)
  if (type === 'explore') return bump(mood, 0.12 * k, 0.15 * k)
  if (type === 'trade') return bump(mood, 0.18 * k, 0.05 * k)
  if (type === 'rest') return bump(mood, 0.1 * k, -0.15 * k)
  if (type === 'move') return bump(mood, 0.02 * k, 0.05 * k)
  if (type === 'goal') return bump(mood, 0.05 * k, 0.1 * k)
  if (type === 'summarize') return bump(mood, 0.08 * k, -0.1 * k)
  if (type === 'weather') return bump(mood, -0.15 * k, 0.2 * k)
  if (type === 'night') return bump(mood, -0.05 * k, 0.1 * k)
  return bump(mood, 0, 0)
}

/** Survival factors influence mood each tick */
export function applySurvivalToMood(mood: Mood, health: number, hunger: number) {
  // Low health → sadness
  if (health < 40) bump(mood, -0.08, 0.05)
  if (health < 20) bump(mood, -0.15, 0.1)
  // High hunger → distress
  if (hunger > 60) bump(mood, -0.05, 0.05)
  if (hunger > 85) bump(mood, -0.12, 0.1)
}

export function decayMood(mood: Mood) {
  mood.valence *= 0.985
  mood.arousal *= 0.985
}

function bump(mood: Mood, dv: number, da: number) {
  mood.valence = clamp(mood.valence + dv, -1, 1)
  mood.arousal = clamp(mood.arousal + da, -1, 1)
  return mood
}
