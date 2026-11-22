import { describe, expect, it } from 'vitest'
import { effectiveRoutineIds, nextTrainingDay } from './history.js'

const start = '2026-11-02'
const state = {
  dayPlan: {},
  week: { 1: ['monday'], 3: ['wednesday'] },
  weekExtra: ['extra'],
  weekCycleStart: start,
  routines: [
    { id: 'monday', name: 'Monday', ex: [{ id: 'a' }] },
    { id: 'wednesday', name: 'Wednesday', ex: [{ id: 'b' }] },
    { id: 'extra', name: 'Extra', ex: [{ id: 'c' }] },
  ],
  queue: null,
  workouts: [],
}

describe('additional weekly cycle days', () => {
  it('schedules the added routine after the seven weekday slots and repeats the cycle', () => {
    expect(effectiveRoutineIds(state, '2026-11-09')).toEqual(['extra'])
    expect(effectiveRoutineIds(state, '2026-11-10')).toEqual(['monday'])
  })

  it('keeps weekday assignments on their weekday inside the extended cycle', () => {
    expect(effectiveRoutineIds(state, '2026-11-04')).toEqual(['wednesday'])
  })

  it('includes the added day when finding the next scheduled workout', () => {
    expect(nextTrainingDay(state, '2026-11-06')?.iso).toBe('2026-11-09')
  })
})
