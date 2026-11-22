import { describe, expect, it } from 'vitest'
import { applyEquipmentFilters, gearOptions } from './library-filters.js'

const exercises = [
  { id: 'machine', bp: 'chest', eq: 'leverage machine' },
  { id: 'cable', bp: 'chest', eq: 'cable' },
  { id: 'dumbbell', bp: 'back', eq: 'dumbbell' },
  { id: 'bodyweight', bp: 'chest', eq: 'body weight' },
]

describe('exercise library equipment filters', () => {
  it('offers only equipment groups present in the current exercise pool, in display order', () => {
    expect(gearOptions(exercises.filter(ex => ex.bp === 'chest')).map(group => group.id))
      .toEqual(['machine', 'cable', 'body weight'])
  })

  it('combines equipment groups with an exact equipment choice', () => {
    expect(applyEquipmentFilters(exercises, { gear: 'machine' }).map(ex => ex.id)).toEqual(['machine'])
    expect(applyEquipmentFilters(exercises, { gear: 'cable', equipment: 'cable' }).map(ex => ex.id)).toEqual(['cable'])
    expect(applyEquipmentFilters(exercises, { gear: 'machine', equipment: 'dumbbell' })).toEqual([])
  })

  it('treats an empty selection as all equipment', () => {
    expect(applyEquipmentFilters(exercises).map(ex => ex.id)).toEqual(['machine', 'cable', 'dumbbell', 'bodyweight'])
  })
})
