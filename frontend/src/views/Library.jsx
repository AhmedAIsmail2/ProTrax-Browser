import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { EXDB, BODYPARTS, allExercises, equipmentOf, searchExercises, similarExercises } from '../lib/exercises.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { bestWeightFor } from '../lib/history.js'
import { fmtNum, exCount } from '../lib/format.js'
import { t, tn, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import { exerciseDetailSheet, addToRoutineSheet, customExSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import ExerciseViewToggle from '../components/ExerciseViewToggle.jsx'
import { Button } from '../components/ui.jsx'
import { tappable, useRevealActiveChip } from '../lib/use-sheet-keyboard.js'
import { useAutoMore } from '../lib/use-auto-more.js'
import { isFav, sortFavouritesFirst, sortYoursFirst, usageOf } from '../lib/favourites.js'
import { gearOptions, applyEquipmentFilters } from '../lib/library-filters.js'

export default function Library() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const [bp, setBp] = useState('')
  const [eq, setEq] = useState('')
  const [gear, setGear] = useState('')
  const [showAll, setShowAll] = useState(false)   // ignore the active equipment profile for this session
  const [shown, setShown] = useState(40)
  const bpStrip = useRef(null)
  const moreRef = useAutoMore(() => setShown(s => s + 40))
  const profile = activeProfile(S)
  // Your own exercises, counted the way the list below shows them (allExercises puts every
  // custom entry in front of the catalogue; deleting one removes it from customEx outright).
  const ownCount = (S.customEx || []).filter(c => c && c.id).length
  const inPart = searchExercises(allExercises(S).filter(e => !bp || e.bp === bp), q)
  const profileFiltered = (profile && !showAll) ? inPart.filter(e => exAvailable(S, e)) : inPart
  const gearOpts = gearOptions(profileFiltered)
  const gearOn = gearOpts.some(g => g.id === gear) ? gear : ''
  const eqFiltered = applyEquipmentFilters(profileFiltered, { gear: gearOn })
  const eqOpts = equipmentOf(eqFiltered)
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const eqOn = eqOpts.includes(eq) ? eq : ''
  // Favourites float to the top of whatever the filters left (issue #6), the rest keeps its order;
  // while searching, the exercises you have logged or planned follow right after them.
  const narrowedList = applyEquipmentFilters(eqFiltered, { equipment: eqOn })
  const usage = useMemo(() => (q.trim() ? usageOf(S) : null), [q, S.routines, S.workouts])
  const f = usage ? sortYoursFirst(narrowedList, S, usage) : sortFavouritesFirst(narrowedList, S)
  useRevealActiveChip(bpStrip, bp)
  // A live count at the end of the search field while a search or filter narrows the list
  // (idea and first version: GitLab !31) — how many are left, before scrolling to find out.
  const narrowed = !!(q.trim() || bp || gearOn || eqOn)
  // Close but not exact (a typo too many, most of the words, a similar name), under the results
  // once they are all on screen, so a search almost never ends on "No match".
  // Worked out a beat behind the typing (useDeferredValue): the list itself never waits for it.
  const qLate = useDeferredValue(q)
  const similar = q.trim() && qLate === q && f.length <= shown
    ? similarExercises(allExercises(S).filter(e => (!bp || e.bp === bp) && (!profile || showAll || exAvailable(S, e))), q, f, f.length ? 12 : 30)
    : []
  const row = e => {
    const best = bestWeightFor(S, e.id)
    // The row is not a button: its name is, stretched over the row (.tap-main), with Add to my plan
    // a sibling above it (card dismiss pass), so neither tap can land on the other.
    return <div key={e.id} className="item tap-host">
      <Thumb ex={e} />
      <button type="button" className="grow item-open tap-main" aria-haspopup="dialog" onClick={() => exerciseDetailSheet(e)}><span className={`tt ${exerciseNameClass(e)}`}>{isFav(S, e.id) && <Icon name="starFill" className="fav-star" />}{exerciseNameFor(e)}</span><span className="ss capitalize">{t(MUSCLE_NAME[e.tg] || e.tg || e.bp)} · {t(e.eq)}</span></button>
      {best > 0 && <span className="tag acc">{fmtNum(best)}</span>}
      {/* a quiet trailing button (P7): the accent stays on the one action of the screen */}
      <button type="button" className="iconbtn lib-add" aria-label={t('Add to my plan')} title={t('Add to my plan')}
        onClick={() => addToRoutineSheet(e)}><Icon name="plus" /></button>
    </div>
  }

  return <>
    <div className="hdr lib-hdr"><div><h1>{t('Exercises')}</h1></div>
      <Button size="sm" variant="tinted" icon="figureStrength" onClick={() => nav('/muscles')}>{t('By muscle')}</Button>
      <div className="sub lib-count">{ownCount
        ? tn('{1} animated exercises + 1 of your own', '{1} animated exercises + {0} of your own', ownCount, EXDB.length)
        : t('{0} exercises with animations', EXDB.length)}</div>
    </div>
    <div className="search-row" data-tour="lib-search" style={{ marginBottom: 10 }}><div className={'search' + (narrowed ? ' has-count' : '') + (q ? ' has-clear' : '')}><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input className="input" placeholder={t('Search…')} value={q} onChange={e => { setQ(e.target.value); setShown(40) }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }} />
      {narrowed && <span className="search-count" role="status" aria-label={exCount(f.length)}>{fmtNum(f.length)}</span>}
      {q && <button className="clear" onClick={() => { setQ(''); setShown(40) }} aria-label={t('Clear')}><Icon name="xmark" /></button>}</div>
      <ExerciseViewToggle /></div>
    {profile && <div className="small dim row" style={{ margin: '-4px 2px 10px', gap: 6, alignItems: 'center' }}>
      <Icon name="kettlebell" style={{ fontSize: 'var(--fs-footnote)' }} />
      {showAll ? t('Showing all equipment') : t('Showing what you have in "{0}"', profile.name)}
      <button className="chip nocap" style={{ marginInlineStart: 'auto', padding: '3px 10px', fontSize: 'var(--fs-caption)' }} onClick={() => setShowAll(v => !v)}>
        {showAll ? t('Filter by "{0}"', profile.name) : t('Show all equipment')}
      </button>
    </div>}
    <div className="lib-filter-stack" data-tour="lib-filters">
      <div className="chips lib-filter-row lib-gear-row" aria-label={t('Equipment type')}>
        <button type="button" className={'chip nocap ichip' + (!gearOn ? ' on' : '')} aria-pressed={!gearOn}
          onClick={() => { setGear(''); setShown(40) }}>{t('All Gear')}</button>
        {gearOpts.map(g => <button type="button" key={g.id} className={'chip ichip' + (gearOn === g.id ? ' on' : '')} aria-pressed={gearOn === g.id}
          onClick={() => { setGear(gearOn === g.id ? '' : g.id); setEq(''); setShown(40) }}><Icon name={g.icon} />{t(g.id)}</button>)}
      </div>
      <div className="chips lib-filter-row" aria-label={t('Body part')} ref={bpStrip}>
        <button type="button" className={'chip nocap' + (!bp ? ' on' : '')} aria-pressed={!bp}
          onClick={() => { setBp(''); setShown(40) }}>{t('All')}</button>
        {BODYPARTS.map(b => <button key={b} type="button" className={'chip' + (bp === b ? ' on' : '')} aria-pressed={bp === b}
          onClick={() => { setBp(bp === b ? '' : b); setShown(40) }}>{t(b)}</button>)}
      </div>
      <div className="chips lib-filter-row lib-equipment-row" aria-label={t('Equipment')}>
        <button type="button" className={'chip nocap' + (!eqOn ? ' on' : '')} aria-pressed={!eqOn}
          onClick={() => { setEq(''); setShown(40) }}>{t('Any equipment')}</button>
        {eqOpts.map(x => <button type="button" key={x} className={'chip' + (eqOn === x ? ' on' : '')} aria-pressed={eqOn === x}
          onClick={() => { setEq(eqOn === x ? '' : x); setShown(40) }}>{t(x)}</button>)}
      </div>
    </div>
    <div className={'list' + (S.exerciseView === 'cards' ? ' ex-grid' : '')}>
      <div className="item ex-new" data-tour="lib-new" {...tappable(() => customExSheet(null, ex => exerciseDetailSheet(ex), q.trim()))}>
        <div className="thumb thumb-x"><Icon name="plusCircle" /></div>
        <div className="grow"><div className="tt">{t('Create your own exercise')}</div><div className="ss">{t('name + body part, and a photo or video if you like')}</div></div><Icon name="plus" className="chev" />
      </div>
      {f.slice(0, shown).map(row)}
      {f.length === 0 && !similar.length && <div className="empty"><div className="ico"><Icon name="magnifier" /></div>{t('No match')}</div>}
      {similar.length > 0 && <h4 className="sec similar-label">{f.length ? t('Similar exercises') : t('No exact match. These come close:')}</h4>}
      {similar.map(row)}
    </div>
    {f.length > shown && <><div style={{ height: 10 }} /><Button ref={moreRef} onClick={() => setShown(s => s + 40)}>{t('Show more')}</Button></>}
  </>
}


