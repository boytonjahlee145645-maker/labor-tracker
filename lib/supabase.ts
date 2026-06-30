import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a no-op client during SSR / build without env vars
    // This will fail gracefully — pages are all 'use client' anyway
    throw new Error('Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  }

  _supabase = createClient(url, key)
  return _supabase
}

// Singleton export — safe because all pages are 'use client'
export const supabase = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  // SSR fallback — will never actually be called since pages are client-only
  // but needs to exist to satisfy module-level import
  : null as unknown as SupabaseClient

export type Worker = {
  id: string
  name: string
  hourly_rate: number
  my_cut_per_hour: number
  is_active: boolean
  created_at: string
}

export type Attendance = {
  id: string
  worker_id: string
  date: string
  shift: 'morning' | 'evening'
  hours_worked: number
  status: 'present' | 'absent' | 'substitute'
  substitute_for: string | null
  created_at: string
  workers?: Worker
}

export type Period = {
  id: string
  start_date: string
  end_date: string
  total_worker_wages: number | null
  my_total_earnings: number | null
  is_settled: boolean
  created_at: string
}
