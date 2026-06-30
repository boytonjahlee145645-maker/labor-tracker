'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { getCurrentShift, calcDailySummary } from '@/lib/calculations'
import { getCurrentPeriod } from '@/lib/periods'

type ActivityDay = {
  date: string
  shift: string
  presentCount: number
  totalHours: number
}

function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <div className="skeleton h-4 w-1/2" />
      <div className="skeleton h-8 w-3/4" />
      <div className="skeleton h-4 w-full" />
    </div>
  )
}

export default function HomeClient() {
  const [loading, setLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState({ presentCount: 0, totalHours: 0, totalWorkers: 0 })
  const [currentShift, setCurrentShift] = useState<'morning' | 'evening'>('morning')
  const [recentActivity, setRecentActivity] = useState<ActivityDay[]>([])
  const [myEarningsToday, setMyEarningsToday] = useState(0)

  const today = format(new Date(), 'yyyy-MM-dd')
  const currentPeriod = getCurrentPeriod()

  useEffect(() => {
    const shift = getCurrentShift()
    setCurrentShift(shift)
    fetchData(shift)
  }, [])

  async function fetchData(shift: 'morning' | 'evening') {
    setLoading(true)
    try {
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('*, workers(*)')
        .eq('date', today)
        .eq('shift', shift)

      if (todayAttendance) {
        const summary = calcDailySummary(todayAttendance)
        setTodaySummary({
          presentCount: summary.presentCount + summary.substituteCount,
          totalHours: summary.totalHours,
          totalWorkers: todayAttendance.length,
        })
        const earnings = todayAttendance.reduce((sum: number, a: any) => {
          if (a.status === 'present' || a.status === 'substitute') {
            return sum + (Number(a.hours_worked) * Number(a.workers?.my_cut_per_hour || 0))
          }
          return sum
        }, 0)
        setMyEarningsToday(earnings)
      }

      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const fromDate = format(threeDaysAgo, 'yyyy-MM-dd')

      const { data: recentData } = await supabase
        .from('attendance')
        .select('date, shift, status, hours_worked')
        .gte('date', fromDate)
        .lt('date', today)
        .order('date', { ascending: false })

      if (recentData) {
        const grouped: Record<string, ActivityDay> = {}
        recentData.forEach((a: any) => {
          const key = `${a.date}-${a.shift}`
          if (!grouped[key]) {
            grouped[key] = { date: a.date, shift: a.shift, presentCount: 0, totalHours: 0 }
          }
          if (a.status === 'present' || a.status === 'substitute') {
            grouped[key].presentCount++
            grouped[key].totalHours += Number(a.hours_worked)
          }
        })
        setRecentActivity(Object.values(grouped).slice(0, 6))
      }
    } finally {
      setLoading(false)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="px-4 pt-6 pb-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {greeting} 👋
          </h1>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: currentShift === 'morning' ? '#f59e0b' : '#6366f1' }}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
            {currentShift}
          </span>
        </div>
      </div>

      {/* Today Summary Card */}
      {loading ? (
        <SkeletonCard />
      ) : (
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
            border: '1px solid rgba(124, 58, 237, 0.3)',
          }}
        >
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Today's {currentShift} shift
          </p>
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span style={{ fontSize: '42px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {todaySummary.presentCount}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  / {todaySummary.totalWorkers} workers
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {todaySummary.totalHours}h total · {myEarningsToday.toFixed(0)} TL my cut
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="dot-present" />
              <span style={{ fontSize: '11px', color: 'var(--accent-green)' }}>Present</span>
            </div>
          </div>
        </div>
      )}

      {/* CTA Button */}
      <Link href="/attendance" className="btn-primary" style={{ display: 'flex', textDecoration: 'none' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Record Today's Attendance
      </Link>

      {/* Period Info */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Current Period
          </span>
          <Link href="/reports" style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500 }}>
            View →
          </Link>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {format(currentPeriod.start, 'MMM d')} – {format(currentPeriod.end, 'MMM d, yyyy')}
        </p>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Recent Activity
        </h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 w-full" />)}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="card text-center py-8">
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No recent activity</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Start recording attendance</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((day, i) => (
              <div
                key={i}
                className="card card-hover flex items-center justify-between"
                style={{ padding: '12px 16px' }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {format(new Date(day.date + 'T12:00:00'), 'EEE, MMM d')}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'capitalize' }}>
                    {day.shift} shift
                  </p>
                </div>
                <div className="text-right">
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {day.presentCount} present
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {day.totalHours}h total
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
