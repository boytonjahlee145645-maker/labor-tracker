'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { supabase, type Worker, type Attendance } from '@/lib/supabase'
import { calcPeriodTotals } from '@/lib/calculations'
import { getRecentPeriods, toISODate, type Period } from '@/lib/periods'

type SortKey = 'name' | 'hours' | 'wages' | 'cut'
type SortDir = 'asc' | 'desc'

function SkeletonReport() {
  return (
    <div className="space-y-3">
      <div className="skeleton h-36 rounded-2xl" />
      <div className="skeleton h-24 rounded-2xl" />
      <div className="skeleton h-60 rounded-2xl" />
    </div>
  )
}

// paid worker IDs for the current period
type PaymentMap = Record<string, boolean>

type PeriodMode = '15d' | 'day' | 'custom'

export default function ReportsClient() {
  const [periods] = useState<Period[]>(() => getRecentPeriods(3))
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('15d')
  const [singleDay, setSingleDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return format(d, 'yyyy-MM-dd') })
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customApplied, setCustomApplied] = useState({ start: '', end: '' })
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [settling, setSettling] = useState(false)
  const [isSettled, setIsSettled] = useState(false)
  const [exported, setExported] = useState(false)
  const [paymentMap, setPaymentMap] = useState<PaymentMap>({})
  const [payingId, setPayingId] = useState<string | null>(null)
  const startY = useRef(0)

  const period = periods[selectedIdx]

  // Derive active date range from mode
  const activeStart = periodMode === '15d' ? toISODate(period.start)
    : periodMode === 'day' ? singleDay
    : customApplied.start || customStart
  const activeEnd = periodMode === '15d' ? toISODate(period.end)
    : periodMode === 'day' ? singleDay
    : customApplied.end || customEnd

  const loadData = useCallback(async () => {
    setLoading(true)
    setIsSettled(false)

    const [{ data: ws }, { data: at }, { data: ps }, { data: pmts }] = await Promise.all([
      supabase.from('workers').select('*').order('name'),
      supabase.from('attendance').select('*').gte('date', activeStart).lte('date', activeEnd).in('status', ['present', 'substitute']),
      supabase.from('periods').select('*').eq('start_date', activeStart).eq('end_date', activeEnd).maybeSingle(),
      supabase.from('worker_payments').select('*').eq('period_start', activeStart).eq('period_end', activeEnd),
    ])

    setWorkers(ws ?? [])
    setAttendance(at ?? [])
    if (ps?.is_settled) setIsSettled(true)
    const map: PaymentMap = {}
    for (const p of (pmts ?? [])) map[p.worker_id] = p.is_paid
    setPaymentMap(map)
    setLoading(false)
  }, [activeStart, activeEnd])

  async function togglePayment(workerId: string, currentlyPaid: boolean) {
    setPayingId(workerId)
    await supabase.from('worker_payments').upsert({
      worker_id: workerId,
      period_start: activeStart,
      period_end: activeEnd,
      is_paid: !currentlyPaid,
      paid_at: !currentlyPaid ? new Date().toISOString() : null,
    }, { onConflict: 'worker_id,period_start,period_end' })
    setPaymentMap(prev => ({ ...prev, [workerId]: !currentlyPaid }))
    setPayingId(null)
  }

  useEffect(() => { loadData() }, [loadData])

  function handleTouchStart(e: React.TouchEvent) { startY.current = e.touches[0].clientY }
  function handleTouchEnd(e: React.TouchEvent) {
    if (e.changedTouches[0].clientY - startY.current > 80) loadData()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const { totalHours, totalWorkerWages, myTotalEarnings, workerBreakdown } = calcPeriodTotals(workers, attendance)

  const sorted = [...workerBreakdown].sort((a, b) => {
    const map = { name: [a.worker.name, b.worker.name], hours: [a.hoursWorked, b.hoursWorked], wages: [a.workerEarnings, b.workerEarnings], cut: [a.myCut, b.myCut] }
    const [va, vb] = map[sortKey]
    const cmp = typeof va === 'string' ? (va as string).localeCompare(vb as string) : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  async function settlePeriod() {
    setSettling(true)
    await supabase.from('periods').upsert({
      start_date: activeStart,
      end_date: activeEnd,
      total_worker_wages: totalWorkerWages,
      my_total_earnings: myTotalEarnings,
      is_settled: true,
    }, { onConflict: 'start_date,end_date' })
    setIsSettled(true)
    setSettling(false)
  }

  function exportText() {
    const lines = [
      `📋 تقرير الفترة`,
      `${activeStart} – ${activeEnd}`,
      ``,
      `👷 العمال:`,
      ...sorted.filter(b => b.hoursWorked > 0).map(b =>
        `• ${b.worker.name}: ${b.hoursWorked}h ← ${b.workerEarnings.toFixed(0)} TL (حصتي: ${b.myCut.toFixed(0)} TL)`
      ),
      ``,
      `📊 الإجماليات:`,
      `مجموع الساعات: ${totalHours}h`,
      `المدير يدفع للعمال: ${totalWorkerWages.toFixed(0)} TL`,
      `💰 حصتي الإجمالية: ${myTotalEarnings.toFixed(0)} TL`,
      isSettled ? `✅ مستلمة` : `⏳ لم تُستلم بعد`,
    ]
    const text = lines.join('\n')
    if (navigator.share) {
      navigator.share({ text, title: 'تقرير الرواتب' }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => { setExported(true); setTimeout(() => setExported(false), 2000) })
    }
  }

  const Arrow = ({ col }: { col: SortKey }) => (
    <span style={{ fontSize: '9px', opacity: sortKey === col ? 1 : 0.3 }}>
      {sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
    </span>
  )

  return (
    <div className="px-4 pt-6 pb-4 animate-fade-in" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Reports</h1>

      {/* Period Selector */}
      <div className="mb-5">
        {/* Mode tabs */}
        <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {([['15d', '15 يوم'], ['day', 'يوم'], ['custom', 'مدة معينة']] as [PeriodMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setPeriodMode(mode)}
              className="flex-1 py-2 text-sm font-semibold transition-all duration-150"
              style={{
                background: periodMode === mode ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: periodMode === mode ? '#a78bfa' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', minHeight: '40px',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 15-day period chips */}
        {periodMode === '15d' && (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {periods.map((p, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: i === selectedIdx ? 'rgba(124,58,237,0.25)' : 'var(--bg-card)',
                  color: i === selectedIdx ? '#a78bfa' : 'var(--text-muted)',
                  border: `1px solid ${i === selectedIdx ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                  whiteSpace: 'nowrap', minHeight: '36px',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Single day picker */}
        {periodMode === 'day' && (
          <input
            type="date"
            value={singleDay}
            onChange={e => setSingleDay(e.target.value)}
            className="input-field"
            style={{ fontSize: '14px', fontWeight: 600 }}
          />
        )}

        {/* Custom range picker */}
        {periodMode === 'custom' && (
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>من</p>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-field" style={{ fontSize: '13px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>إلى</p>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-field" style={{ fontSize: '13px' }} />
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ minHeight: '40px', fontSize: '13px' }}
              onClick={() => setCustomApplied({ start: customStart, end: customEnd })}
            >
              تطبيق
            </button>
          </div>
        )}
      </div>

      {loading ? <SkeletonReport /> : (
        <div className="space-y-4">
          {/* MY EARNINGS Hero */}
          <div
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(5,150,105,0.2) 0%, rgba(16,185,129,0.08) 100%)',
              border: '1px solid rgba(5,150,105,0.35)',
            }}
          >
            <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(circle at 80% 50%, #059669, transparent 70%)' }} />
            <p style={{ fontSize: '11px', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
              💰 حصتي الإجمالية
            </p>
            <div className="flex items-end justify-between mt-2">
              <div>
                <p style={{ fontSize: '52px', fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg, #34d399, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {myTotalEarnings.toFixed(0)}
                  <span style={{ fontSize: '22px', fontWeight: 600, marginLeft: '4px' }}>TL</span>
                </p>
                {isSettled && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(5,150,105,0.2)', color: '#34d399' }}>
                    ✅ Settled
                  </span>
                )}
              </div>
              <div className="text-right">
                <p style={{ fontSize: '13px', color: '#6ee7b7', fontWeight: 500 }}>{totalHours}h total</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {format(period.start, 'MMM d')} – {format(period.end, 'd')}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total Hours', value: `${totalHours}h`, color: '#a78bfa' },
              { label: 'Manager Owes', value: `${totalWorkerWages.toFixed(0)} TL`, color: '#60a5fa' },
              { label: 'Active Workers', value: `${workers.filter(w => w.is_active).length}`, color: '#fb923c' },
            ].map(item => (
              <div key={item.label} className="card text-center" style={{ padding: '12px 6px' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: item.color }}>{item.value}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.2 }}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* Worker Breakdown Cards */}
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '10px' }}>
              تفصيل العمال
            </p>

            {sorted.length === 0 ? (
              <div className="card text-center py-10">
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>لا يوجد حضور في هذه الفترة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map(({ worker, hoursWorked, workerEarnings, myCut }) => (
                  <div key={worker.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '16px', overflow: 'hidden' }}>
                    {/* ── Header row ── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                      {/* Left: avatar + name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                          background: hoursWorked > 0 ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : 'var(--bg-secondary)',
                          color: hoursWorked > 0 ? 'white' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px', fontWeight: 800,
                        }}>
                          {worker.name[0]}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{worker.name}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{worker.hourly_rate} TL/h</p>
                        </div>
                      </div>
                      {/* Right: PAID / PENDING badge */}
                      {hoursWorked > 0 && (
                        paymentMap[worker.id] ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            border: '1px solid rgba(52,211,153,0.4)', borderRadius: '999px',
                            padding: '5px 12px', fontSize: '12px', fontWeight: 700,
                            color: '#34d399', background: 'rgba(52,211,153,0.1)', whiteSpace: 'nowrap',
                          }}>✅ اندفعلو</span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            border: '1px solid rgba(245,158,11,0.4)', borderRadius: '999px',
                            padding: '5px 12px', fontSize: '12px', fontWeight: 700,
                            color: '#fbbf24', background: 'rgba(245,158,11,0.1)', whiteSpace: 'nowrap',
                          }}>⏳ لم يُدفع</span>
                        )
                      )}
                      {!hoursWorked && (
                        <span style={{ border: '1px solid var(--border)', borderRadius: '999px', padding: '5px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'transparent' }}>
                          لم يعمل
                        </span>
                      )}
                    </div>

                    {/* ── Divider ── */}
                    <div style={{ height: '1px', background: 'var(--border)', margin: '0 16px' }} />

                    {/* ── Stats row: HRS | WAGE | CUT ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', padding: '14px 16px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px' }}>الساعات</p>
                        <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: hoursWorked > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{hoursWorked}<span style={{ fontSize: '11px', fontWeight: 500, marginRight: '2px', color: 'var(--text-muted)' }}>h</span></p>
                      </div>
                      <div style={{ background: 'var(--border)', width: '1px', height: '36px', margin: '0 auto' }} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px' }}>راتبه</p>
                        <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: hoursWorked > 0 ? '#60a5fa' : 'var(--text-muted)' }}>{workerEarnings.toFixed(0)}<span style={{ fontSize: '11px', fontWeight: 500, marginRight: '2px', color: 'var(--text-muted)' }}>TL</span></p>
                      </div>
                      <div style={{ background: 'var(--border)', width: '1px', height: '36px', margin: '0 auto' }} />
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '10px', color: myCut > 0 ? '#34d399' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px' }}>حصتي</p>
                        <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: myCut > 0 ? '#34d399' : 'var(--text-muted)' }}>{myCut.toFixed(0)}<span style={{ fontSize: '11px', fontWeight: 500, marginRight: '2px', color: 'var(--text-muted)' }}>TL</span></p>
                      </div>
                    </div>

                    {/* ── Record Payment button ── */}
                    {hoursWorked > 0 && (
                      <>
                        <div style={{ height: '1px', background: 'var(--border)' }} />
                        <button
                          onClick={() => togglePayment(worker.id, !!paymentMap[worker.id])}
                          disabled={payingId === worker.id}
                          style={{
                            width: '100%', padding: '12px', border: 'none', cursor: 'pointer',
                            background: 'transparent',
                            color: paymentMap[worker.id] ? '#ef4444' : '#60a5fa',
                            fontSize: '13px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            opacity: payingId === worker.id ? 0.5 : 1,
                            transition: 'opacity 0.2s',
                          }}
                        >
                          {payingId === worker.id ? '...' : paymentMap[worker.id] ? '↩ إلغاء الدفع' : '💸 سجّل الدفع'}
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {/* Total card */}
                <div style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(59,130,246,0.06))', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(124,58,237,0.2)' }}>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>الإجمالي للفترة</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', padding: '14px 16px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px' }}>الساعات</p>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#a78bfa' }}>{totalHours}<span style={{ fontSize: '11px', marginRight: '2px' }}>h</span></p>
                    </div>
                    <div style={{ background: 'rgba(124,58,237,0.3)', width: '1px', height: '36px', margin: '0 auto' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px' }}>رواتب العمال</p>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#60a5fa' }}>{totalWorkerWages.toFixed(0)}<span style={{ fontSize: '11px', marginRight: '2px' }}>TL</span></p>
                    </div>
                    <div style={{ background: 'rgba(124,58,237,0.3)', width: '1px', height: '36px', margin: '0 auto' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '10px', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '5px' }}>حصتي</p>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#34d399' }}>{myTotalEarnings.toFixed(0)}<span style={{ fontSize: '11px', marginRight: '2px' }}>TL</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button className="btn-primary" onClick={exportText}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {exported ? '✓ Copied!' : 'Share / Copy Summary'}
            </button>
            {!isSettled && myTotalEarnings > 0 && (
              <button className="btn-secondary" onClick={settlePeriod} disabled={settling}>
                {settling ? 'Saving...' : '✅ Mark as Settled'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
