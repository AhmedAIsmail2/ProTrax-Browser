import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { EXIDX, exOr } from '../lib/exercises.js'
import { exLine, isBw, metricRowsForEntry } from '../lib/history.js'
import { exerciseNameFor, t } from '../lib/i18n.js'
import { fmtDate, fmtNum } from '../lib/format.js'
import { Segmented } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { Thumb } from '../components/Media.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { tappable } from '../lib/use-sheet-keyboard.js'

const RANGES = [
  { value: 30, label: '1M' }, { value: 90, label: '3M' },
  { value: 180, label: '6M' }, { value: 0, label: 'All' },
]

function exerciseName(id, workouts) {
  if (EXIDX[id]) return exerciseNameFor(EXIDX[id])
  for (const workout of workouts) {
    const entry = workout.entries?.find(item => item.id === id)
    if (entry) return entry.muscleSnapshot?.n || entry.n || id
  }
  return id
}

export default function TrainingProgress() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const openSheet = useUI(s => s.openSheet)
  const routines = S.routines || []
  const [routineId, setRoutineId] = useState(routines[0]?.id || '')
  const routine = routines.find(item => item.id === routineId) || routines[0]
  const [exerciseId, setExerciseId] = useState('')
  const [range, setRange] = useState(0)

  const exercises = useMemo(() => {
    if (!routine) return []
    return [...new Set((routine.ex || []).map(item => item.id))].map(id => ({
      id,
      name: exerciseName(id, S.workouts || []),
      cfg: (routine.ex || []).find(item => item.id === id),
      exercise: EXIDX[id] || exOr(id),
    }))
  }, [routine, S.workouts])
  const selectedExercise = exercises.find(item => item.id === exerciseId) || exercises[0]

  const sessions = useMemo(() => {
    if (!routine || !selectedExercise) return []
    const cutoff = range ? Date.now() - range * 86400000 : 0
    return [...(S.workouts || [])]
      .filter(workout => workout.routineId === routine.id)
      .map(workout => {
        const entry = (workout.entries || []).find(item => item.id === selectedExercise.id)
        if (!entry) return null
        const rows = metricRowsForEntry(entry, 'reps')
        if (!rows.length) return null
        return { workout, rows }
      })
      .filter(Boolean)
      .filter(session => !cutoff || Number(session.workout.start || new Date(session.workout.d).getTime()) >= cutoff)
      .sort((a, b) => String(b.workout.d).localeCompare(String(a.workout.d)))
  }, [S.workouts, routine, selectedExercise, range])

  const differences = (row, previous) => {
    if (!previous) return null
    const reps = (Number(row.r) || 0) - (Number(previous.r) || 0)
    const weight = (Number(row.w) || 0) - (Number(previous.w) || 0)
    if (!reps && !weight) return null
    return { reps, weight }
  }

  const chooseRoutine = () => openSheet(close => <>
    <h3>{t('Choose a routine')}</h3>
    <div className="list">{routines.map(item => <div key={item.id} className="item" {...tappable(() => {
      setRoutineId(item.id); setExerciseId(''); close()
    })}>
      <span className="lrow-i"><Icon name={glyphOf(item.emoji)} /></span>
      <div className="grow"><div className="tt">{item.name}</div><div className="ss">{t('{0} exercises', (item.ex || []).length)}</div></div>
      {routine?.id === item.id && <Icon name="check" className="accent" />}
    </div>)}</div>
  </>)

  const chooseExercise = () => openSheet(close => <>
    <h3>{t('Choose an exercise')}</h3>
    <div className="list">{exercises.map(item => <div key={item.id} className="item" {...tappable(() => {
      setExerciseId(item.id); close()
    })}>
      <Thumb ex={item.exercise} />
      <div className="grow"><div className="tt">{item.name}</div><div className="ss">{exLine(item.cfg, S.unit)}</div></div>
      {selectedExercise?.id === item.id && <Icon name="check" className="accent" />}
    </div>)}</div>
  </>)

  return <div className="training-progress">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}><h1>{t('Training progress')}</h1><div className="sub">{t('Compare every set across sessions')}</div></div>
    </div>

    {!routines.length ? <div className="empty"><div className="ico"><Icon name="dumbbell" /></div>{t('Create a routine first to explore its exercise history.')}</div> : <>
      <div className="card tp-controls">
        {routine && <div className="item tp-picker" {...tappable(chooseRoutine)}>
          <span className="lrow-i"><Icon name={glyphOf(routine.emoji)} /></span>
          <div className="grow"><div className="tt">{routine.name}</div><div className="ss">{t('Routine')}</div></div>
          <Icon name="chevronDown" className="chev" />
        </div>}
        {selectedExercise && <div className="item tp-picker" {...tappable(chooseExercise)}>
          <Thumb ex={selectedExercise.exercise} />
          <div className="grow"><div className="tt">{selectedExercise.name}</div><div className="ss">{t('Exercise')}</div></div>
          <Icon name="chevronDown" className="chev" />
        </div>}
        <div className="tp-control-label">{t('Period')}</div>
        <Segmented className="seg-range" value={range} onChange={setRange} options={RANGES} />
      </div>

      {selectedExercise && <>
        <div className="row between" style={{ margin: '18px 2px 10px' }}>
          <div><h2 style={{ margin: 0 }}>{selectedExercise.name}</h2><div className="sub">{routine.name}</div></div>
          <span className="tp-session-count">{t('{0} sessions', sessions.length)}</span>
        </div>
        {sessions.length ? <div className="tp-sessions">
          {sessions.map(({ workout, rows }, sessionIndex) => {
            const previous = sessions[sessionIndex + 1]?.rows || []
            return <article className="card tp-session" key={workout.id || `${workout.d}-${sessionIndex}`}>
              <div className="row between tp-session-head">
                <div className="tp-date"><Icon name="calendar" /><span>{fmtDate(workout.d, true, true)}</span><small>{t('{0} sets', rows.length)}</small></div>
                <span className="tp-col-label">{t('Reps')}</span>
                <span className="tp-col-label">{t('Weight')}</span>
              </div>
              <div className="tp-set-list">
                {rows.map((row, index) => {
                  const delta = differences(row, previous[index])
                  return <div className="tp-set-row" key={row.id || index}>
                    <span className="tp-set-number">{t('Set {0}', index + 1)}</span>
                    <span className="tp-metric-cell">
                      <b className="tp-value">{fmtNum(Number(row.r) || 0)} {t('reps')}</b>
                      {delta?.reps ? <span className={'tp-delta ' + (delta.reps > 0 ? 'up' : 'down')}>{delta.reps > 0 ? '+' : '−'}{fmtNum(Math.abs(delta.reps))} {t('reps')}</span> : null}
                    </span>
                    <span className="tp-metric-cell">
                      <b className="tp-value">{isBw(selectedExercise.cfg)
                        ? (Number(row.w) > 0 ? `+${fmtNum(Number(row.w))} ${S.unit}` : t('Body weight'))
                        : `${fmtNum(Number(row.w) || 0)} ${S.unit}`}</b>
                      {delta?.weight ? <span className={'tp-delta ' + (delta.weight > 0 ? 'up' : 'down')}>{delta.weight > 0 ? '+' : '−'}{fmtNum(Math.abs(delta.weight))} {S.unit}</span> : null}
                    </span>
                  </div>
                })}
              </div>
            </article>
          })}
        </div> : <div className="empty tp-empty"><div className="ico"><Icon name="chart" /></div>{t('No logged sessions for this exercise in this period.')}</div>}
      </>}
    </>}
  </div>
}
