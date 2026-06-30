'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, type Worker } from '@/lib/supabase'

const workerSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب').max(100),
  hourly_rate: z.coerce.number().min(0, 'مطلوب'),
  my_cut_per_hour: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(20)]),
  is_active: z.boolean(),
})

type WorkerForm = z.output<typeof workerSchema>

function CutBadge({ cut }: { cut: number }) {
  if (cut === 20) return <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600 }}>+20 TL/h</span>
  if (cut === 10) return <span className="badge-cut-10">+10 TL/h</span>
  if (cut === 5) return <span className="badge-cut-5">+5 TL/h</span>
  return <span className="badge-cut-0">+0 TL/h</span>
}

function SkeletonWorker() {
  return (
    <div className="card space-y-2" style={{ padding: '14px 16px' }}>
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3 w-24" />
    </div>
  )
}

function WorkerSheet({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker | null
  onClose: () => void
  onSaved: () => void
}) {
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<WorkerForm>({
    resolver: zodResolver(workerSchema) as any,
    defaultValues: {
      name: worker?.name ?? '',
      hourly_rate: worker?.hourly_rate ?? 0,
      my_cut_per_hour: (worker?.my_cut_per_hour ?? 0) as 0 | 5 | 10 | 20,
      is_active: worker?.is_active ?? true,
    },
  })

  const cutValue = watch('my_cut_per_hour')
  const isActive = watch('is_active')

  async function onSubmit(data: WorkerForm) {
    setSaveError('')
    try {
      if (worker) {
        const { error } = await supabase.from('workers').update(data).eq('id', worker.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('workers').insert(data)
        if (error) throw error
      }
      onSaved()
      onClose()
    } catch (e: any) {
      setSaveError(e?.message ?? 'حدث خطأ، حاول مرة أخرى')
    }
  }

  async function handleDelete() {
    if (!worker) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('workers').delete().eq('id', worker.id)
      if (error) throw error
      onSaved()
      onClose()
    } catch (e: any) {
      setSaveError(e?.message ?? 'خطأ في الحذف')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return createPortal(
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet-content">
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div className="px-5 pb-8 pt-2">
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {worker ? 'تعديل عامل' : 'إضافة عامل'}
            </h2>
            {worker && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
                حذف
              </button>
            )}
          </div>

          {/* Confirm delete */}
          {confirmDelete && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <p style={{ fontSize: '14px', color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>
                حذف {worker?.name}؟
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                سيتم حذف جميع سجلات الحضور المرتبطة به أيضاً.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    background: '#ef4444', color: 'white', border: 'none',
                    fontWeight: 700, cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  {deleting ? 'جاري الحذف...' : 'نعم، احذف'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', fontWeight: 600,
                    cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {saveError && (
            <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p style={{ fontSize: '13px', color: '#ef4444' }}>{saveError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                الاسم
              </label>
              <input {...register('name')} className="input-field" placeholder="اسم العامل" />
              {errors.name && <p style={{ fontSize: '12px', color: 'var(--accent-red)', marginTop: '4px' }}>{errors.name.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                الأجر بالساعة (TL)
              </label>
              <input
                {...register('hourly_rate', { valueAsNumber: true })}
                type="number" step="0.5" min="0"
                className="input-field" placeholder="مثال: 45"
              />
              {errors.hourly_rate && <p style={{ fontSize: '12px', color: 'var(--accent-red)', marginTop: '4px' }}>{errors.hourly_rate.message}</p>}
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                حصتي بالساعة
              </label>
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {([0, 5, 10, 20] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setValue('my_cut_per_hour', val)}
                    className="flex-1 py-3 text-sm font-semibold transition-all duration-150"
                    style={{
                      background: cutValue === val
                        ? val === 20 ? 'rgba(59,130,246,0.3)' : val === 10 ? 'rgba(5,150,105,0.3)' : val === 5 ? 'rgba(217,119,6,0.3)' : 'rgba(107,114,128,0.3)'
                        : 'transparent',
                      color: cutValue === val
                        ? val === 20 ? '#60a5fa' : val === 10 ? '#34d399' : val === 5 ? '#fbbf24' : '#9ca3af'
                        : 'var(--text-muted)',
                      border: 'none', cursor: 'pointer', minHeight: '44px',
                    }}
                  >
                    {val === 0 ? 'لا شيء' : `${val} TL`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>نشط</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>غير النشطين لن يظهروا في الحضور</p>
              </div>
              <button
                type="button"
                onClick={() => setValue('is_active', !isActive)}
                style={{
                  width: '48px', height: '28px',
                  background: isActive ? '#7c3aed' : 'var(--bg-secondary)',
                  border: `1px solid ${isActive ? '#7c3aed' : 'var(--border)'}`,
                  borderRadius: '14px', cursor: 'pointer', position: 'relative',
                }}
              >
                <span style={{
                  width: '20px', height: '20px', background: 'white', borderRadius: '50%',
                  left: isActive ? '24px' : '3px', transition: 'left 0.2s ease',
                  display: 'block', position: 'absolute', top: '3px',
                }} />
              </button>
            </div>

            <div className="space-y-2 pt-2">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'جاري الحفظ...' : worker ? 'حفظ التغييرات' : 'إضافة العامل'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  )
}

function WorkerStatsSheet({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [stats, setStats] = useState<{ hours: number; wages: number; myCut: number } | null>(null)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const day = now.getDate()
      const startDate = day <= 15
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-16`

      const { data } = await supabase
        .from('attendance')
        .select('hours_worked, status')
        .eq('worker_id', worker.id)
        .gte('date', startDate)
        .in('status', ['present', 'substitute'])

      if (data) {
        const hours = data.reduce((sum: number, a: any) => sum + Number(a.hours_worked), 0)
        setStats({ hours, wages: hours * Number(worker.hourly_rate), myCut: hours * Number(worker.my_cut_per_hour) })
      }
    }
    load()
  }, [worker])

  return createPortal(
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet-content">
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div className="px-5 pb-8 pt-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white' }}>
              {worker.name[0]}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{worker.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{worker.hourly_rate} TL/h</span>
                <CutBadge cut={Number(worker.my_cut_per_hour)} />
              </div>
            </div>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            إحصاء الفترة الحالية
          </p>

          {stats === null ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16" />)}</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'الساعات', value: `${stats.hours}h`, color: '#a78bfa' },
                { label: 'أجره', value: `${stats.wages.toFixed(0)} TL`, color: '#60a5fa' },
                { label: 'حصتي', value: `${stats.myCut.toFixed(0)} TL`, color: '#34d399' },
              ].map(item => (
                <div key={item.label} className="card text-center" style={{ padding: '12px 8px' }}>
                  <p style={{ fontSize: '18px', fontWeight: 700, color: item.color }}>{item.value}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{item.label}</p>
                </div>
              ))}
            </div>
          )}

          <button className="btn-secondary mt-4" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </>,
    document.body
  )
}

export default function WorkersClient() {
  const router = useRouter()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editWorker, setEditWorker] = useState<Worker | null>(null)

  const fetchWorkers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('workers').select('*').order('is_active', { ascending: false }).order('name')
    setWorkers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchWorkers() }, [fetchWorkers])

  const activeWorkers = workers.filter(w => w.is_active)
  const inactiveWorkers = workers.filter(w => !w.is_active)

  return (
    <div className="px-4 pt-6 pb-4 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>العمال</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{activeWorkers.length} نشط</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <SkeletonWorker key={i} />)}</div>
      ) : workers.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">👷</div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>لا يوجد عمال بعد</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>اضغط + لإضافة أول عامل</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {activeWorkers.map(worker => (
              <div key={worker.id} className="card" style={{ padding: '14px 16px' }}>
                <div className="flex items-center justify-between">
                  <button className="flex items-center gap-3 flex-1 text-left min-w-0" onClick={() => router.push(`/workers/${worker.id}`)}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', color: 'white' }}>
                      {worker.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {worker.name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{worker.hourly_rate} TL/h</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <CutBadge cut={Number(worker.my_cut_per_hour)} />
                    <button
                      onClick={() => { setEditWorker(worker); setSheetOpen(true) }}
                      style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {inactiveWorkers.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', marginTop: '8px' }}>
                غير نشطين
              </p>
              <div className="space-y-2">
                {inactiveWorkers.map(worker => (
                  <button key={worker.id} className="card card-hover w-full text-left opacity-50" style={{ padding: '14px 16px' }}
                    onClick={() => { setEditWorker(worker); setSheetOpen(true) }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                          {worker.name[0]}
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{worker.name}</p>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>غير نشط</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button className="fab animate-pulse-glow" onClick={() => { setEditWorker(null); setSheetOpen(true) }} aria-label="Add worker">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {sheetOpen && <WorkerSheet worker={editWorker} onClose={() => setSheetOpen(false)} onSaved={fetchWorkers} />}
    </div>
  )
}
