import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYN, weekOrder, weekStartOf, uid, exCount, todayISO, startOfWeek, isoOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, extraDayAssignSheet, starterPlanSheet, menuSheet, exportPlanFile, importPlanFile, printWholePlan, planHasRoutines } from '../sheets.jsx'
import { copyRoutine, deleteRoutine, restoreRoutine, routineSnapshot } from '../lib/routines.js'
import { useListReorder, moved } from '../lib/use-list-reorder.js'
import { workoutControls } from '../lib/workout-controls.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import SwipeRow from '../components/SwipeRow.jsx'
import BodyMap from '../components/BodyMap.jsx'
import { exOr } from '../lib/exercises.js'
import { musclesOf } from '../lib/muscles.js'
import { getApiKey } from '../lib/coach-secrets.js'

const PLAN_VIEW_KEY = 'gym_plan_view'

function viewFromStorage() {
  try { return localStorage.getItem(PLAN_VIEW_KEY) === 'routines' ? 'routines' : 'schedule' } catch { return 'schedule' }
}

export function deleteRoutineWithUndo(id) {
  const before = routineSnapshot(useStore.getState().S, id)
  if (!before) return false
  useStore.getState().update(s => { deleteRoutine(s, id) })
  useUI.getState().toast(t('“{0}” gone.', before.routine.name), {
    action: t('Undo'),
    onAction: () => {
      const live = useStore.getState()
      let restored = false
      live.update(s => { restored = restoreRoutine(s, before) })
      if (!restored) useUI.getState().toast(t('It’s already back.'))
    },
  })
  return true
}

function duplicateRoutineWithUndo(id) {
  const current = useStore.getState()
  const index = current.S.routines.findIndex(routine => routine.id === id)
  if (index < 0) return false
  const copy = copyRoutine(current.S.routines[index])
  current.update(s => { s.routines.splice(index + 1, 0, copy) })
  useUI.getState().toast(t('Copied as “{0}”.', copy.name), {
    action: t('Undo'),
    onAction: () => useStore.getState().update(s => { s.routines = s.routines.filter(routine => routine.id !== copy.id) }),
  })
  return copy
}

function routineLoad(list) {
  const load = {}
  for (const routine of list) for (const item of routine?.ex || []) {
    const ex = exOr(item?.id || item)
    if (ex) for (const [muscle, amount] of Object.entries(musclesOf(ex))) load[muscle] = (load[muscle] || 0) + amount
  }
  return load
}

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const fileRef = useRef(null)
  const [view, setViewState] = useState(viewFromStorage)
  const [editing, setEditing] = useState(false)
  const routines = S.routines || []
  const swipeEnabled = workoutControls(S).swipeSets
  const extras = Array.isArray(S.weekExtra) ? S.weekExtra : []
  const cycleStart = S.weekCycleStart || isoOf(startOfWeek(todayISO(), weekStartOf(S)))
  const order = extras.length ? weekOrder(new Date(cycleStart + 'T12:00:00').getDay()) : weekOrder(weekStartOf(S))
  const hasPlan = planHasRoutines(S)
  const openCoach = async () => {
    const coachLocal = useStore.getState().coachLocal
    if (coachLocal?.mode === 'byok' && await getApiKey()) nav('/coach')
    else nav('/coach/setup')
  }

  const setView = value => {
    setEditing(false)
    setViewState(value)
    try { localStorage.setItem(PLAN_VIEW_KEY, value) } catch { /* private browsing */ }
  }
  const extraDayLabel = index => {
    const d = new Date(cycleStart + 'T12:00:00')
    d.setDate(d.getDate() + 7 + index)
    return DAYN[d.getDay()]
  }
  const addDay = () => update(s => {
    if (!Array.isArray(s.weekExtra)) s.weekExtra = []
    if (!s.weekExtra.length || !s.weekCycleStart) s.weekCycleStart = isoOf(startOfWeek(todayISO(), weekStartOf(s)))
    s.weekExtra = [...s.weekExtra, null]
  })
  const removeDay = index => update(s => {
    s.weekExtra = (s.weekExtra || []).filter((_, i) => i !== index)
    if (!s.weekExtra.length) s.weekCycleStart = null
  })
  const addRoutine = () => {
    const routine = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(routine) })
    setEditing(false)
    nav('/plan/r/' + routine.id)
  }
  const reorder = (from, to) => update(s => { s.routines = moved(s.routines, from, to) })
  const reorderUI = useListReorder(routines.length, reorder)
  const openPlanTools = () => menuSheet({
    title: t('Plan options'),
    subtitle: hasPlan ? undefined : t('Add an exercise to a routine first. An empty plan has nothing to share.'),
    items: [
      { icon: 'share', label: t('Export plan file'), disabled: !hasPlan, onClick: exportPlanFile },
      { icon: 'print', label: t('Print / Save as PDF'), disabled: !hasPlan, onClick: printWholePlan },
      { icon: 'download', label: t('Import a plan file'), onClick: () => fileRef.current?.click() },
    ],
  })
  const scheduledDays = useMemo(() => {
    const map = new Map()
    for (const day of Object.keys(S.week || {})) {
      const short = t(DAYN[Number(day)]).slice(0, 2)
      for (const id of [].concat(S.week[day] || [])) map.set(id, [...(map.get(id) || []), short])
    }
    return map
  }, [S.week])

  return <div className="plan">
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      <div className="row" style={{ gap: 6 }}>
        <Button type="button" size="sm" variant="tinted" icon="sparkles" onClick={e => { e.stopPropagation(); openCoach() }}>{t('Coach')}</Button>
        <button type="button" className="iconbtn plan-share" onClick={e => { e.stopPropagation(); openPlanTools() }} aria-label={t('Plan options')} title={t('Plan options')}><Icon name="share" /></button>
      </div>
    </div>

    <Segmented className="plan-views" value={view} onChange={setView} options={[
      { value: 'schedule', label: t('Schedule'), icon: 'calendar' },
      { value: 'routines', label: t('Routines'), icon: 'dumbbell' },
    ]} />

    {view === 'schedule' ? <section className="plan-schedule" aria-label={t('Week schedule')}>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {order.map(day => {
          const ids = [].concat(S.week?.[day] || [])
          const dayRoutines = ids.map(id => routines.find(r => r.id === id)).filter(Boolean)
          return <div key={day} className="item plan-day" aria-label={t(DAYN[day])} {...tappable(() => dayAssignSheet(day))}>
            <span className="plan-day-n">{t(DAYN[day]).slice(0, 3)}</span>
            <span className={'lrow-i' + (dayRoutines.length ? '' : ' rest')}><Icon name={dayRoutines.length ? glyphOf(dayRoutines[0].emoji) : 'moon'} /></span>
            <div className="grow"><div className="tt">{dayRoutines.length ? dayRoutines.map(r => r.name).join(' + ') : t('Rest day')}</div>
              <div className="ss">{dayRoutines.length ? exCount(dayRoutines.reduce((sum, r) => sum + (r.ex || []).length, 0)) : t('Tap to plan something')}</div></div>
            {dayRoutines.length > 0 && <BodyMap load={routineLoad(dayRoutines)} body={S.body || 'male'} className="plan-mini-map" />}
            <Icon name="chevronRight" className="chev" />
          </div>
        })}
        {extras.map((id, index) => {
          const routine = routines.find(r => r.id === id)
          return <div key={'extra-' + index} className="item plan-day extra-plan-day">
            <button type="button" className="extra-day-open" onClick={e => { e.stopPropagation(); extraDayAssignSheet(index, extraDayLabel(index)) }}>
              <span className="plan-day-n">{t(extraDayLabel(index)).slice(0, 3)}</span>
              <span className={'lrow-i' + (routine ? '' : ' rest')}><Icon name={routine ? glyphOf(routine.emoji) : 'moon'} /></span>
              <span className="grow"><span className="tt">{routine?.name || t('Rest day')}</span><span className="ss">{t('Additional cycle day')}</span></span>
              {routine && <BodyMap load={routineLoad([routine])} body={S.body || 'male'} className="plan-mini-map" />}
              <Icon name="chevronRight" className="chev" />
            </button>
            <button type="button" className="iconbtn plan-day-delete" aria-label={t('Delete day')} onClick={e => { e.stopPropagation(); removeDay(index) }}><Icon name="trash" /></button>
          </div>
        })}
      </div>
      <Button type="button" size="sm" variant="tinted" icon="plus" onClick={addDay} style={{ marginTop: 10 }}>{t('New day')}</Button>
    </section> : <section className="plan-routines" aria-label={t('Routines')}>
      <div className="row between plan-sec-h plan-routines-bar">
        <h4 className="sec">{t('Routines')}</h4>
        <div className="row plan-sec-acts" style={{ gap: 10 }}>
          {routines.length > 0 && <button type="button" className="plan-textbtn" onClick={() => setEditing(v => !v)}>{t(editing ? 'Done' : 'Edit')}</button>}
          <Button type="button" size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New routine')}</Button>
        </div>
      </div>
      {editing && <div className="small dim" style={{ margin: '0 2px 10px' }}>{t('Drag to reorder. Tap the minus to delete.')}</div>}
      {routines.length ? <div className="list" ref={reorderUI.listRef}>
        {routines.map((routine, index) => {
          const days = scheduledDays.get(routine.id) || []
          const row = <div className={'item' + (!swipeEnabled ? ' plan-routine' : '')} role="button" tabIndex={0} {...(!editing ? tappable(() => nav('/plan/r/' + routine.id)) : {})}>
            {editing && <button type="button" className="plan-minus" aria-label={t('Delete {0}', routine.name)} onClick={() => deleteRoutineWithUndo(routine.id)}><Icon name="minus" /></button>}
            <div className="lrow-i"><Icon name={glyphOf(routine.emoji)} /></div>
            <div className="grow"><div className="tt">{routine.name}</div><div className="ss">{exCount((routine.ex || []).length)}{days.length ? ' · ' + days.join(', ') : ''}</div></div>
            {!editing && <BodyMap load={routineLoad([routine])} body={S.body || 'male'} className="plan-mini-map" />}
            {!editing && <Icon name="chevronRight" className="chev" />}
            {editing && routines.length > 1 && <button type="button" className="plan-handle" aria-label={t('Move {0}', routine.name)} {...reorderUI.handle(index)}><Icon name="grip" /></button>}
          </div>
          const rowProps = { key: routine.id, className: 'plan-routine', 'data-reorder-row': '', style: reorderUI.rowStyle(index) }
          return swipeEnabled
            ? <SwipeRow {...rowProps} canSwipe={() => !editing} onDelete={() => deleteRoutineWithUndo(routine.id)}
              onCopy={() => !editing && duplicateRoutineWithUndo(routine.id)} deleteLabel={t('Delete')} copyLabel={t('Duplicate')} copyIcon="copy">{row}</SwipeRow>
            : <div {...rowProps}>{row}</div>
        })}
      </div> : <div className="empty plan-empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}
        <div style={{ height: 12 }} /><Button type="button" variant="primary" icon="sparkles" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
      </div>}
    </section>}

    <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={event => {
      const file = event.target.files?.[0]
      if (file) importPlanFile(file)
      event.target.value = ''
    }} />
  </div>
}
