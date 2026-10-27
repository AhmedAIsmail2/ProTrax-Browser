import { describe, it, expect } from 'vitest'
import { matchExercise, normalizeStr } from './exercises.js'
import { _setLangState } from './i18n-core.js'

describe('normalizeStr', () => {
  it('handles null, undefined and empty strings', () => {
    expect(normalizeStr(null)).toBe('')
    expect(normalizeStr(undefined)).toBe('')
    expect(normalizeStr('')).toBe('')
  })

  it('lowercases text and removes diacritics / accents', () => {
    expect(normalizeStr('Elevação Lateral')).toBe('elevacao lateral')
    expect(normalizeStr('SUPINO INCLINADO COM HALTERES')).toBe('supino inclinado com halteres')
    expect(normalizeStr('Tríceps & Panturrilhas')).toBe('triceps & panturrilhas')
    expect(normalizeStr('Quadríceps / Glúteos')).toBe('quadriceps / gluteos')
  })
})

describe('matchExercise', () => {
  const benchPress = {
    id: '0025',
    n: 'barbell bench press',
    bp: 'chest',
    tg: 'pectorals',
    eq: 'barbell',
    sm: ['triceps', 'deltoids'],
    desc: 'Classic chest exercise using a barbell on a flat bench.'
  }

  const lateralRaise = {
    id: '0283',
    n: 'dumbbell lateral raise',
    bp: 'shoulders',
    tg: 'delts',
    eq: 'dumbbell',
    sm: ['traps'],
    desc: 'Shoulder isolation movement.'
  }

  it('returns true for empty or whitespace-only query', () => {
    expect(matchExercise(benchPress, '')).toBe(true)
    expect(matchExercise(benchPress, '   ')).toBe(true)
    expect(matchExercise(benchPress, null)).toBe(true)
  })

  it('matches exact and partial words in exercise name regardless of case', () => {
    expect(matchExercise(benchPress, 'bench')).toBe(true)
    expect(matchExercise(benchPress, 'BENCH')).toBe(true)
    expect(matchExercise(benchPress, 'barbell')).toBe(true)
    expect(matchExercise(benchPress, 'press')).toBe(true)
    expect(matchExercise(benchPress, 'squat')).toBe(false)
  })

  it('matches multiple tokens in ANY order (not just sequential)', () => {
    // "bench barbell" is reversed order compared to "barbell bench press"
    expect(matchExercise(benchPress, 'bench barbell')).toBe(true)
    expect(matchExercise(benchPress, 'press bench barbell')).toBe(true)
    expect(matchExercise(benchPress, 'barbell press chest')).toBe(true)
    expect(matchExercise(benchPress, 'bench squat')).toBe(false)
  })

  it('matches target muscle, equipment, secondary muscles and description', () => {
    expect(matchExercise(benchPress, 'pectorals')).toBe(true)
    expect(matchExercise(benchPress, 'triceps barbell')).toBe(true)
    expect(matchExercise(benchPress, 'flat bench')).toBe(true)
    expect(matchExercise(lateralRaise, 'dumbbell shoulder')).toBe(true)
  })

  it('matches accent-insensitively', () => {
    const customEx = {
      id: 'custom-1',
      n: 'Elevação de Panturrilha',
      bp: 'lower legs',
      tg: 'calves',
      eq: 'body weight',
      desc: 'Exercício para panturrilhas em pé.'
    }

    expect(matchExercise(customEx, 'elevacao')).toBe(true)
    expect(matchExercise(customEx, 'elevação')).toBe(true)
    expect(matchExercise(customEx, 'panturrilha elevacao')).toBe(true)
    expect(matchExercise(customEx, 'ELEVACAO PE')).toBe(true)
  })

  it('matches translated UI terms when a language is active', () => {
    _setLangState('es', {
      chest: 'pecho',
      barbell: 'barra',
      dumbbell: 'mancuernas',
      shoulders: 'hombros'
    }, null)

    // "pecho" is the translated bp, "barra" is the translated eq
    expect(matchExercise(benchPress, 'pecho')).toBe(true)
    expect(matchExercise(benchPress, 'barra')).toBe(true)
    expect(matchExercise(benchPress, 'pecho barra bench')).toBe(true)
    expect(matchExercise(lateralRaise, 'mancuernas hombros')).toBe(true)
  })

  it('matches common gym acronyms and machine aliases', () => {
    const rdl = { id: '0032', n: 'barbell romanian deadlift', bp: 'upper legs', eq: 'barbell', tg: 'hamstrings' }
    const ohp = { id: '0041', n: 'barbell overhead press', bp: 'shoulders', eq: 'barbell', tg: 'delts' }
    const chestMachine = { id: '0523', n: 'lever chest press', bp: 'chest', eq: 'leverage machine', tg: 'pectorals' }
    const pecDeck = { id: '0528', n: 'lever seated fly', bp: 'chest', eq: 'leverage machine', tg: 'pectorals' }
    const dbCurl = { id: '0285', n: 'dumbbell biceps curl', bp: 'upper arms', eq: 'dumbbell', tg: 'biceps' }

    expect(matchExercise(rdl, 'rdl')).toBe(true)
    expect(matchExercise(ohp, 'ohp')).toBe(true)
    expect(matchExercise(chestMachine, 'machine')).toBe(true)
    expect(matchExercise(chestMachine, 'machine chest')).toBe(true)
    expect(matchExercise(pecDeck, 'pec deck')).toBe(true)
    expect(matchExercise(dbCurl, 'db curl')).toBe(true)
    expect(matchExercise(dbCurl, 'bicep')).toBe(true)
  })
})


