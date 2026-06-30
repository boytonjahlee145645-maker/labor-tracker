'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase, type Worker, type Attendance } from '@/lib/supabase'

function StatusPill({ status, hours }: { status: string; hours: number }) {
  if (status === 'present') return (
    <span style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
      ✓ حضور · {hours}h
    </span>
  )
  if (status === 'substitute') return (
    <span style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
      ↔ بديل · {hours}h
    </span>
  )
  return (
    <span style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
      ✕ غياب
    </span>
  )
}

export default function WorkerProfileClient({ workerId }: { workerId: string }) {
  const router = useRouter()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  // Month filter: 0 = current, 1 = last, 2 = 2 months ago
  const [monthOffset, setMonthOffset] = useState(0)

  const monthStart = format(startOfMonth(subMonths(new Date(), monthOffset)), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(subMonths(new Date(), monthOffset)), 'yyyy-MM-dd')
  const monthLabel = format(subMonths(new Date(), monthOffset), 'MMMM yyyy')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: w }, { data: att }] = await Promise.all([
      supabase.from('workers').select('*').eq('id', workerId).single(),
      supabase.from('attendance').select('*')
        .eq('worker_id', workerId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false }),
    ])
    if (w) setWorker(w)
    setRecords(att ?? [])
    setLoading(false)
  }, [workerId, monthStart, monthEnd])

  useEffect(() => { loadData() }, [loadData])

  // Compute stats for filtered month
  const presentRecords = records.filter(r => r.status === 'present' || r.status === 'substitute')
  const totalHours = presentRecords.reduce((s, r) => s + Number(r.hours_worked), 0)
  const totalEarnings = worker ? totalHours * Number(worker.hourly_rate) : 0
  const totalMyCut = worker ? totalHours * Number(worker.my_cut_per_hour) : 0
  const presentDays = presentRecords.length
  const absentDays = records.filter(r => r.status === 'absent').length

  if (loading) return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton w-8 h-8 rounded-full" />
        <div className="skeleton h-6 rounded-xl" style={{ width: 120 }} />
      </div>
      <div className="skeleton h-32 rounded-2xl mb-4" />
      <div className="skeleton h-24 rounded-2xl mb-4" />
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-2xl" />)}
      </div>
    </div>
  )

  if (!worker) return (
    <div className="px-4 pt-10 text-center">
      <p style={{ color: 'var(--text-muted)' }}>العامل غير موجود</p>
      <button onClick={() => router.back()} className="btn-secondary mt-4">← رجوع</button>
    </div>
  )

  return (
    <div className="px-4 pt-6 pb-32">
      {/* Back + header */}
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px', padding: 0 }}
      >
        ← رجوع
      </button>

      {/* Worker hero card */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7c3aed,#3b82f6)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 800, flexShrink: 0,
          }}>
            {worker.name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{worker.name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {worker.hourly_rate} TL/h · حصتي {worker.my_cut_per_hour} TL/h
            </p>
          </div>
          <span style={{
            padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
            background: worker.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(107,114,128,0.12)',
            color: worker.is_active ? '#34d399' : 'var(--text-muted)',
            border: `1px solid ${worker.is_active ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
          }}>
            {worker.is_active ? 'نشط' : 'غير نشط'}
          </span>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        {[2, 1, 0].map(offset => {
          const label = format(subMonths(new Date(), offset), 'MMM yyyy')
          return (
            <button
              key={offset}
              onClick={() => setMonthOffset(offset)}
              className="flex-1 py-2 text-sm font-semibold transition-all duration-150"
              style={{
                background: monthOffset === offset ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: monthOffset === offset ? '#a78bfa' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', minHeight: '40px',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Month stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr 1px 1fr', background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '14px 8px', marginBottom: '16px', alignItems: 'center' }}>
        {[
          { label: 'ساعات', value: `${totalHours}h`, color: '#a78bfa' },
          { label: 'حضور', value: `${presentDays}`, color: '#34d399' },
          { label: 'غياب', value: `${absentDays}`, color: '#f87171' },
          { label: 'حصتي', value: `${totalMyCut.toFixed(0)} TL`, color: '#34d399' },
        ].reduce((acc: React.ReactNode[], item, i) => {
          if (i > 0) acc.push(<div key={`d${i}`} style={{ background: 'var(--border)', width: '1px', height: '36px' }} />)
          acc.push(
            <div key={item.label} style={{ textAlign: 'center', padding: '0 4px' }}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: item.color }}>{item.value}</p>
              <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{item.label}</p>
            </div>
          )
          return acc
        }, [])}
      </div>

      {/* راتبه كاملاً هذا الشهر */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)' }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: '4px' }}>راتبه الكامل — {monthLabel}</p>
        <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#60a5fa' }}>
          {totalEarnings.toFixed(0)}<span style={{ fontSize: '14px', fontWeight: 500, marginRight: '4px' }}> TL</span>
        </p>
      </div>

      {/* Attendance history */}
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '10px' }}>
        سجل الحضور — {monthLabel}
      </p>

      {records.length === 0 ? (
        <div className="card text-center py-10">
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>لا يوجد سجل في هذا الشهر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(record => (
            <div
              key={record.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '12px 14px',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {format(parseISO(record.date), 'EEE، d MMM')}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {record.shift === 'morning' ? '🌅 صباحي' : '🌙 مسائي'}
                </p>
              </div>
              <StatusPill status={record.status} hours={Number(record.hours_worked)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
