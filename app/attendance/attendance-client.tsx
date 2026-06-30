'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { supabase, type Worker, type Attendance } from '@/lib/supabase'
import { getCurrentShift, calcDailySummary } from '@/lib/calculations'

type AttendanceState = {
  worker: Worker
  status: 'present' | 'absent' | 'substitute'
  hours_worked: number
  substitute_for: string | null
  existingId: string | null
}

function SubstituteSheet({
  workers,
  absentWorkerName,
  onClose,
  onConfirm,
}: {
  workers: Worker[]
  absentWorkerName: string
  onClose: () => void
  onConfirm: (substituteForId: string, hours: number) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [hours, setHours] = useState(8)

  return createPortal(
    <>
      <div className="sheet-overlay" onClick={onClose} style={{ zIndex: 60 }} />
      <div className="sheet-content" style={{ zIndex: 70 }}>
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div className="px-5 pb-8 pt-2">
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Add Substitute
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Who is covering for <strong style={{ color: 'var(--text-secondary)' }}>{absentWorkerName}</strong>?
          </p>
          <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className="w-full text-left card"
                style={{
                  padding: '12px',
                  border: selectedId === w.id ? '1px solid #7c3aed' : '1px solid var(--border)',
                  background: selectedId === w.id ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-card)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{w.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>{w.hourly_rate} TL/h</span>
              </button>
            ))}
          </div>
          <div className="mb-4">
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Hours worked
            </label>
            <input
              type="number"
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              min="0" step="0.5" className="input-field"
            />
          </div>
          <button
            className="btn-primary"
            disabled={!selectedId}
            onClick={() => { onConfirm(selectedId, hours); onClose() }}
          >
            Confirm Substitute
          </button>
          <button className="btn-secondary mt-2" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>,
    document.body
  )
}

export default function AttendanceClient() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedShift, setSelectedShift] = useState<'morning' | 'evening'>(getCurrentShift())
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attendanceStates, setAttendanceStates] = useState<AttendanceState[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [subSheetFor, setSubSheetFor] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null) // worker id
  const startY = useRef(0)

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    const { data: workersData } = await supabase
      .from('workers').select('*').eq('is_active', true).order('name')
    const { data: attendanceData } = await supabase
      .from('attendance').select('*').eq('date', selectedDate).eq('shift', selectedShift)

    const ws = workersData ?? []
    const ad = attendanceData ?? []
    setWorkers(ws)
    setAttendanceStates(ws.map((w: Worker) => {
      const existing = ad.find((a: Attendance) => a.worker_id === w.id)
      return {
        worker: w,
        status: existing?.status ?? 'present',
        hours_worked: existing?.hours_worked ?? 0,
        substitute_for: existing?.substitute_for ?? null,
        existingId: existing?.id ?? null,
      }
    }))
    setLoading(false)
  }, [selectedDate, selectedShift])

  useEffect(() => { loadAttendance() }, [loadAttendance])

  function handleTouchStart(e: React.TouchEvent) { startY.current = e.touches[0].clientY }
  function handleTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches[0].clientY - startY.current > 80) loadAttendance()
  }

  function updateState(workerId: string, update: Partial<AttendanceState>) {
    setAttendanceStates(prev => prev.map(s => s.worker.id === workerId ? { ...s, ...update } : s))
  }

  async function saveAll() {
    setSaving(true)
    setSaveError('')
    try {
      // Don't include id — let the unique constraint on (worker_id,date,shift) handle upsert
      const upserts = attendanceStates.map(s => ({
        worker_id: s.worker.id,
        date: selectedDate,
        shift: selectedShift,
        status: s.status,
        hours_worked: s.status === 'absent' ? 0 : s.hours_worked,
        substitute_for: s.status === 'substitute' ? s.substitute_for : null,
      }))
      const { error } = await supabase.from('attendance').upsert(upserts, { onConflict: 'worker_id,date,shift' })
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await loadAttendance()
    } catch (e: any) {
      setSaveError(e?.message ?? 'خطأ في الحفظ، حاول مرة أخرى')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord(workerId: string) {
    const state = attendanceStates.find(s => s.worker.id === workerId)
    if (!state?.existingId) {
      // Not saved yet, just reset to defaults
      updateState(workerId, { status: 'present', hours_worked: 8, substitute_for: null, existingId: null })
      setDeleteConfirm(null)
      return
    }
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', state.existingId)
      if (error) throw error
      await loadAttendance()
    } catch (e: any) {
      setSaveError(e?.message ?? 'خطأ في الحذف')
    }
    setDeleteConfirm(null)
  }

  const presentStates = attendanceStates.filter(s => s.status === 'present' || s.status === 'substitute')
  const totalHours = presentStates.reduce((sum, s) => sum + Number(s.hours_worked), 0)
  const myEarningsNow = presentStates.reduce((sum, s) => sum + (Number(s.hours_worked) * Number(s.worker.my_cut_per_hour)), 0)
  const subSheetWorker = subSheetFor ? attendanceStates.find(s => s.worker.id === subSheetFor)?.worker : null

  return (
    <div className="flex flex-col min-h-dvh animate-fade-in" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Sticky Header */}
      <div className="px-4 pt-6 pb-4 sticky top-0 z-20" style={{ background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)' }}>
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Attendance</h1>

        {/* Date Picker */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
            style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >‹</button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input-field flex-1 text-center"
            style={{ fontSize: '14px', fontWeight: 600 }}
          />
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}
            style={{ width: 40, height: 40, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >›</button>
        </div>

        {/* Shift Toggle */}
        <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {(['morning', 'evening'] as const).map(shift => (
            <button
              key={shift}
              onClick={() => setSelectedShift(shift)}
              className="flex-1 py-2 text-sm font-semibold capitalize transition-all duration-200"
              style={{
                background: selectedShift === shift
                  ? shift === 'morning' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'
                  : 'transparent',
                color: selectedShift === shift
                  ? shift === 'morning' ? '#fbbf24' : '#a78bfa'
                  : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', minHeight: '40px',
              }}
            >
              {shift === 'morning' ? '☀️' : '🌙'} {shift}
            </button>
          ))}
        </div>

        {/* Summary Bar */}
        {!loading && (
          <div className="flex items-center justify-around py-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-center">
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#34d399' }}>{presentStates.length}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Present</p>
            </div>
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <div className="text-center">
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>
                {attendanceStates.filter(s => s.status === 'absent').length}
              </p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Absent</p>
            </div>
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <div className="text-center">
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#a78bfa' }}>{totalHours}h</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hours</p>
            </div>
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <div className="text-center">
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#34d399' }}>{myEarningsNow.toFixed(0)}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>My TL</p>
            </div>
          </div>
        )}
      </div>

      {/* Worker List */}
      <div className="flex-1 px-4 space-y-2 pt-2" style={{ paddingBottom: '200px' }}>
        {loading ? (
          [1,2,3,4,5].map(i => <div key={i} className="skeleton h-24 w-full rounded-2xl" />)
        ) : attendanceStates.length === 0 ? (
          <div className="card text-center py-12 mt-4">
            <div className="text-3xl mb-2">👷</div>
            <p style={{ color: 'var(--text-muted)' }}>No active workers</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Add workers from the Workers tab</p>
          </div>
        ) : (
          attendanceStates.map(state => (
            <div
              key={state.worker.id}
              className="card"
              style={{
                padding: '14px 16px',
                borderColor:
                  state.status === 'present' ? 'rgba(16,185,129,0.3)' :
                  state.status === 'substitute' ? 'rgba(59,130,246,0.3)' :
                  'rgba(239,68,68,0.2)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={state.status === 'present' ? 'dot-present' : state.status === 'substitute' ? 'dot-substitute' : 'dot-absent'}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {state.worker.name}
                      </p>
                      {state.existingId && (
                        <span style={{ fontSize: '9px', background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, flexShrink: 0 }}>✓ محفوظ</span>
                      )}
                    </div>
                    {state.status === 'substitute' && state.substitute_for && (
                      <p style={{ fontSize: '11px', color: '#60a5fa', marginTop: '1px' }}>
                        Sub for: {workers.find(w => w.id === state.substitute_for)?.name ?? '—'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Present / Absent toggle */}
                <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <button
                    onClick={() => updateState(state.worker.id, { status: 'present', substitute_for: null })}
                    style={{
                      padding: '8px 14px', fontSize: '13px', fontWeight: 700,
                      background: state.status === 'present' ? 'rgba(16,185,129,0.3)' : 'transparent',
                      color: state.status === 'present' ? '#34d399' : 'var(--text-muted)',
                      border: 'none', cursor: 'pointer', minHeight: '40px',
                    }}
                  >✓</button>
                  <button
                    onClick={() => updateState(state.worker.id, { status: 'absent', hours_worked: 0, substitute_for: null })}
                    style={{
                      padding: '8px 14px', fontSize: '13px', fontWeight: 700,
                      background: state.status === 'absent' ? 'rgba(239,68,68,0.3)' : 'transparent',
                      color: state.status === 'absent' ? '#ef4444' : 'var(--text-muted)',
                      border: 'none', cursor: 'pointer', minHeight: '40px',
                    }}
                  >✗</button>
                </div>
              </div>

              {/* Hours selector: 0 / 9h / 11h */}
              {(state.status === 'present' || state.status === 'substitute') && (
                <div className="flex items-center gap-2 mt-3">
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ساعات:</span>
                  <div className="flex rounded-xl overflow-hidden flex-1"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    {[0, 9, 11].map(h => (
                      <button
                        key={h}
                        onClick={() => updateState(state.worker.id, { hours_worked: h })}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          border: 'none',
                          cursor: 'pointer',
                          minHeight: '40px',
                          fontSize: '14px',
                          fontWeight: state.hours_worked === h ? 700 : 500,
                          background: state.hours_worked === h
                            ? h === 0
                              ? 'rgba(107,114,128,0.25)'
                              : 'rgba(124,58,237,0.3)'
                            : 'transparent',
                          color: state.hours_worked === h
                            ? h === 0 ? '#9ca3af' : '#a78bfa'
                            : 'var(--text-muted)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {h === 0 ? '—' : `${h}h`}
                      </button>
                    ))}
                  </div>
                  {state.hours_worked > 0 && Number(state.worker.my_cut_per_hour) > 0 && (
                    <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      +{(state.hours_worked * Number(state.worker.my_cut_per_hour)).toFixed(0)} TL
                    </span>
                  )}
                </div>
              )}

              {/* Add substitute link */}
              {state.status === 'absent' && (
                <button
                  onClick={() => setSubSheetFor(state.worker.id)}
                  style={{ marginTop: '10px', color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, minHeight: '32px' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  Assign substitute
                </button>
              )}
              {/* Delete record button */}
              {deleteConfirm === state.worker.id ? (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => deleteRecord(state.worker.id)}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                  >
                    نعم، احذف
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                state.existingId && (
                  <button
                    onClick={() => setDeleteConfirm(state.worker.id)}
                    style={{ marginTop: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px', padding: 0, opacity: 0.7 }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    حذف سجل الحضور
                  </button>
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* Save Button */}
      <div
        className="fixed left-0 right-0 px-4 py-3"
        style={{
          bottom: 'calc(72px + max(0px, env(safe-area-inset-bottom)))',
          background: 'rgba(10,10,15,0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border)',
        }}
      >
        {saveError && (
          <div className="mb-2 rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p style={{ fontSize: '12px', color: '#ef4444' }}>⚠ {saveError}</p>
          </div>
        )}
        <button
          className="btn-primary"
          onClick={saveAll}
          disabled={saving || attendanceStates.length === 0}
          style={{ background: saved ? 'linear-gradient(135deg, #059669, #047857)' : undefined }}
        >
          {saved ? '✓ Saved!' : saving ? 'Saving...' : `Save ${selectedShift === 'morning' ? '☀️' : '🌙'} Attendance`}
        </button>
      </div>

      {/* Substitute Sheet */}
      {subSheetFor && subSheetWorker && (
        <SubstituteSheet
          workers={workers.filter(w => w.id !== subSheetFor)}
          absentWorkerName={subSheetWorker.name}
          onClose={() => setSubSheetFor(null)}
          onConfirm={(substituteWorkerId, hours) => {
            setAttendanceStates(prev => {
              const updated = prev.map(s => {
                if (s.worker.id === subSheetFor) {
                  return { ...s, status: 'substitute' as const, hours_worked: hours, substitute_for: substituteWorkerId }
                }
                return s
              })
              return updated
            })
            setSubSheetFor(null)
          }}
        />
      )}
    </div>
  )
}
