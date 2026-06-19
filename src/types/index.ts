export type Category =
  | 'Learning'
  | 'Work'
  | 'Entertainment'
  | 'Social Media'
  | 'Shopping'
  | 'Finance'
  | 'News'
  | 'Other'

export interface PageVisit {
  id?: number
  url: string
  title: string
  domain: string
  category: Category
  startTime: number
  endTime: number
  duration: number  // seconds
  date: string      // YYYY-MM-DD
}

export interface Highlight {
  id?: number
  text: string
  url: string
  title: string
  domain: string
  category: Category
  timestamp: number
  date: string
}

export interface ClipboardEntry {
  id?: number
  content: string
  type: 'text' | 'url' | 'phone'
  timestamp: number
  date: string
}

export interface DailySummary {
  date: string
  totalTime: number
  categoryBreakdown: Record<Category, number>
  topDomains: { domain: string; duration: number }[]
  focusScore: number
}
