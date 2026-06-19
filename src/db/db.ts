import Dexie, { Table } from 'dexie'
import type { PageVisit, Highlight, ClipboardEntry } from '../types'

export class ShadowShelfDB extends Dexie {
  visits!: Table<PageVisit, number>
  highlights!: Table<Highlight, number>
  clipboard!: Table<ClipboardEntry, number>

  constructor() {
    super('ShadowShelfDB')
    this.version(1).stores({
      visits:    '++id, url, domain, category, date, startTime',
      highlights:'++id, url, domain, date, timestamp',
      clipboard: '++id, type, date, timestamp',
    })
  }
}

export const db = new ShadowShelfDB()

export async function pruneOldData(retentionDays: number = 30) {
  const cutoff = Date.now() - retentionDays * 86400_000
  const cutoffDate = new Date(cutoff).toISOString().slice(0, 10)
  await db.visits.where('date').below(cutoffDate).delete()
  await db.highlights.where('date').below(cutoffDate).delete()
  await db.clipboard.where('date').below(cutoffDate).delete()

  // Keep clipboard to 100 entries max
  const count = await db.clipboard.count()
  if (count > 100) {
    const oldest = await db.clipboard.orderBy('timestamp').limit(count - 100).primaryKeys()
    await db.clipboard.bulkDelete(oldest)
  }
}

export async function getTodayStats() {
  const today = new Date().toISOString().slice(0, 10)
  const visits = await db.visits.where('date').equals(today).toArray()
  const totalTime = visits.reduce((s, v) => s + v.duration, 0)
  const breakdown: Record<string, number> = {}
  for (const v of visits) {
    breakdown[v.category] = (breakdown[v.category] ?? 0) + v.duration
  }
  return { visits, totalTime, breakdown, date: today }
}

export async function getWeekStats() {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000)
    days.push(d.toISOString().slice(0, 10))
  }
  const visits = await db.visits.where('date').anyOf(days).toArray()
  const byDay: Record<string, typeof visits> = {}
  for (const d of days) byDay[d] = []
  for (const v of visits) byDay[v.date]?.push(v)
  return { byDay, days }
}
