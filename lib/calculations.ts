import { Attendance, Worker } from './supabase'

/**
 * Calculate earnings for a single worker across a list of attendance records
 */
export function calcWorkerEarnings(
  worker: Worker,
  attendanceRecords: Attendance[]
): {
  hoursWorked: number
  workerEarnings: number
  myCut: number
} {
  const relevantRecords = attendanceRecords.filter(
    (a) => a.worker_id === worker.id && (a.status === 'present' || a.status === 'substitute')
  )

  const hoursWorked = relevantRecords.reduce(
    (sum, a) => sum + Number(a.hours_worked),
    0
  )
  const workerEarnings = hoursWorked * Number(worker.hourly_rate)
  const myCut = hoursWorked * Number(worker.my_cut_per_hour)

  return { hoursWorked, workerEarnings, myCut }
}

/**
 * Calculate totals for a full period across all workers
 */
export function calcPeriodTotals(
  workers: Worker[],
  attendanceRecords: Attendance[]
): {
  totalHours: number
  totalWorkerWages: number
  myTotalEarnings: number
  workerBreakdown: Array<{
    worker: Worker
    hoursWorked: number
    workerEarnings: number
    myCut: number
  }>
} {
  let totalHours = 0
  let totalWorkerWages = 0
  let myTotalEarnings = 0

  const workerBreakdown = workers.map((worker) => {
    const { hoursWorked, workerEarnings, myCut } = calcWorkerEarnings(
      worker,
      attendanceRecords
    )
    totalHours += hoursWorked
    totalWorkerWages += workerEarnings
    myTotalEarnings += myCut

    return { worker, hoursWorked, workerEarnings, myCut }
  })

  return {
    totalHours,
    totalWorkerWages,
    myTotalEarnings,
    workerBreakdown,
  }
}

/**
 * Calculate today's quick summary for a given shift
 */
export function calcDailySummary(attendanceRecords: Attendance[]): {
  presentCount: number
  absentCount: number
  substituteCount: number
  totalHours: number
} {
  const presentCount = attendanceRecords.filter(
    (a) => a.status === 'present'
  ).length
  const absentCount = attendanceRecords.filter(
    (a) => a.status === 'absent'
  ).length
  const substituteCount = attendanceRecords.filter(
    (a) => a.status === 'substitute'
  ).length
  const totalHours = attendanceRecords
    .filter((a) => a.status === 'present' || a.status === 'substitute')
    .reduce((sum, a) => sum + Number(a.hours_worked), 0)

  return { presentCount, absentCount, substituteCount, totalHours }
}

/**
 * Auto-detect current shift based on time (morning < 14:00, evening >= 14:00)
 */
export function getCurrentShift(): 'morning' | 'evening' {
  const hour = new Date().getHours()
  return hour < 14 ? 'morning' : 'evening'
}

/**
 * Format a number as TL currency
 */
export function formatTL(amount: number): string {
  return `${amount.toFixed(2)} TL`
}
