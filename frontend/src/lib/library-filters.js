export const GEAR_GROUPS = [
  { id: 'machine', icon: 'gear', matches: eq => /machine|leverage|sled|hack squat/.test(eq) },
  { id: 'cable', icon: 'link', matches: eq => /cable/.test(eq) },
  { id: 'dumbbell', icon: 'dumbbell', matches: eq => /dumbbell/.test(eq) },
  { id: 'barbell', icon: 'barbell', matches: eq => /barbell|ez bar/.test(eq) },
  { id: 'body weight', icon: 'figureStrength', matches: eq => /body weight/.test(eq) },
  { id: 'kettlebell', icon: 'kettlebell', matches: eq => /kettlebell/.test(eq) },
]

export const gearMatches = (group, exercise) =>
  GEAR_GROUPS.find(g => g.id === group)?.matches(String(exercise?.eq || '').toLowerCase()) || false

export const gearOptions = exercises =>
  GEAR_GROUPS.filter(group => exercises.some(exercise => gearMatches(group.id, exercise)))

export const applyEquipmentFilters = (exercises, { gear = '', equipment = '' } = {}) =>
  exercises.filter(exercise => (!gear || gearMatches(gear, exercise)) && (!equipment || exercise.eq === equipment))
