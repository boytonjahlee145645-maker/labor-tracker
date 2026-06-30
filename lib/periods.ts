import {
  startOfMonth,
  endOfMonth,
  setDate,
  format,
  isWithinInterval,
  parseISO,
} from 'date-fns'

export type Period = {
  start: Date
  end: Date
  label: string
}

/**
 * Generate two 15-day periods for a given month:
 * - Period 1: 1st → 15th
 * - Period 2: 16th → end of month
 */
export function getPeriodsForMonth(date: Date): Period[] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const mid = setDate(date, 15)
  const midPlusOne = setDate(date, 16)

  return [
    {
      start: monthStart,
      end: mid,
      label: `${format(monthStart, 'MMM d')} – ${format(mid, 'MMM d, yyyy')}`,
    },
    {
      start: midPlusOne,
      end: monthEnd,
      label: `${format(midPlusOne, 'MMM d')} – ${format(monthEnd, 'MMM d, yyyy')}`,
    },
  ]
}

/**
 * Determine which period a given date falls in
 */
export function getPeriodForDate(date: Date): Period {
  const periods = getPeriodsForMonth(date)
  for (const period of periods) {
    if (isWithinInterval(date, { start: period.start, end: period.end })) {
      return period
    }
  }
  return periods[0]
}

/**
 * Get the current active period
 */
export function getCurrentPeriod(): Period {
  return getPeriodForDate(new Date())
}

/**
 * Generate periods going back N months
 */
export function getRecentPeriods(monthsBack: number = 3): Period[] {
  const periods: Period[] = []
  const now = new Date()

  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthPeriods = getPeriodsForMonth(d)
    // Add in reverse so most recent first
    periods.push(...monthPeriods.reverse())
  }

  return periods.slice(0, monthsBack * 2 + 2)
}

/**
 * Format date as ISO date string (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Parse ISO date string to Date object
 */
export function fromISODate(dateStr: string): Date {
  return parseISO(dateStr)
}
