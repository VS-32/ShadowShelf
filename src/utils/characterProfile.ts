import type { PageVisit, Category } from '../types'

export interface CharacterProfile {
  archetype: string
  emoji: string
  tagline: string
  description: string
  dominantTrait: string
  peakHour: string
  productivityTips: string[]
  color: string
  strengths: string[]
}

const ARCHETYPES: Record<string, Omit<CharacterProfile, 'dominantTrait' | 'peakHour'>> = {
  Scholar: {
    archetype: 'The Scholar',
    emoji: '🎓',
    tagline: 'Knowledge is your currency',
    description: 'You invest heavily in learning. Your browsing reflects a curious, growth-oriented mind that constantly seeks to understand the world deeper.',
    productivityTips: [
      'Use the Feynman Technique — after reading, explain the concept in simple words',
      'Space your learning sessions: 25 min focus + 5 min review works best for retention',
      'Build a "second brain" — save key highlights and revisit them weekly',
      'Try to apply what you learn within 24 hours to cement it in memory',
    ],
    color: '#06b6d4',
    strengths: ['Curiosity', 'Depth of thinking', 'Continuous improvement'],
  },
  Professional: {
    archetype: 'The Professional',
    emoji: '💼',
    tagline: 'Results-driven and always on',
    description: 'Work dominates your digital life. You are outcome-focused and spend your online time building, collaborating, and executing.',
    productivityTips: [
      'Block your first 2 hours for deep work — no meetings, no Slack',
      'Use time-boxing: assign fixed windows to tasks to avoid perfectionism paralysis',
      'Set a hard stop time each day — sustainable performance requires recovery',
      'Batch communication: check email/Slack at fixed intervals, not constantly',
    ],
    color: '#10b981',
    strengths: ['Execution', 'Focus', 'Reliability'],
  },
  Creator: {
    archetype: 'The Creator',
    emoji: '🚀',
    tagline: 'Learning and building in equal measure',
    description: 'You split your time between learning and doing. You absorb knowledge to build things — a rare and powerful combination.',
    productivityTips: [
      'Create before you consume — do your building work before browsing',
      'Document your process: your journey is as valuable as the outcome',
      'Set a "maker schedule": long uninterrupted blocks beat fragmented hours',
      'Share what you build — feedback accelerates growth more than more reading',
    ],
    color: '#8b5cf6',
    strengths: ['Versatility', 'Innovation', 'Self-direction'],
  },
  Explorer: {
    archetype: 'The Explorer',
    emoji: '🧭',
    tagline: 'Curious about everything, everywhere',
    description: 'You roam freely across topics and domains. Your mind is wide-ranging and refuses to be boxed in — a sign of a truly curious intellect.',
    productivityTips: [
      'Channel your curiosity: set a weekly "deep dive" topic to go beyond surface-level',
      'Use a capture system — you encounter great ideas; don\'t let them vanish',
      'Pick one project per month to pursue deeply instead of many shallowly',
      'Your breadth is a gift — find ways to connect dots others miss',
    ],
    color: '#22d3ee',
    strengths: ['Broad knowledge', 'Adaptability', 'Creative connections'],
  },
  SocialConnector: {
    archetype: 'The Social Connector',
    emoji: '🤝',
    tagline: 'Your network is your power',
    description: 'You live and breathe social media. You are tuned in to conversations, trends, and people — a natural communicator and community builder.',
    productivityTips: [
      'Set social media time blocks: 20 min in morning, 20 min evening — no more',
      'Unfollow accounts that don\'t teach, inspire, or genuinely entertain you',
      'Use your social energy for real networking: reach out to 1 person weekly',
      'Turn passive scrolling into active learning: follow creators in your field',
    ],
    color: '#ec4899',
    strengths: ['Communication', 'Trend awareness', 'Relationship building'],
  },
  Analyst: {
    archetype: 'The Analyst',
    emoji: '📊',
    tagline: 'Data-driven and financially sharp',
    description: 'Finance and news feed your decision-making. You seek information to act on, not just to know — a disciplined and rational thinker.',
    productivityTips: [
      'Follow the 24-hour rule before making financial decisions to avoid impulse',
      'Curate your news: one trusted source is better than ten noisy ones',
      'Turn market insights into written hypotheses — journaling sharpens judgment',
      'Balance information intake with execution: analysis paralysis is real',
    ],
    color: '#eab308',
    strengths: ['Critical thinking', 'Research', 'Decision quality'],
  },
  Entertainer: {
    archetype: 'The Entertainer',
    emoji: '🎬',
    tagline: 'Life\'s too short for boring content',
    description: 'Entertainment is your dominant mode. You love rich experiences, stories, and creativity — but your best self knows when to switch to "create mode".',
    productivityTips: [
      'Try a "work first, reward later" system — finish one task before each entertainment session',
      'Set an entertainment budget: decide your hours for the week in advance',
      'Find content that entertains AND teaches — documentaries, educational YouTube',
      'Use entertainment as fuel: what you enjoy often hints at what you should create',
    ],
    color: '#f97316',
    strengths: ['Creativity appreciation', 'Cultural awareness', 'Enjoyment of life'],
  },
  NightOwl: {
    archetype: 'The Night Owl',
    emoji: '🦉',
    tagline: 'The world is quieter — and better — after midnight',
    description: 'You come alive when the world goes quiet. Your peak creative hours are late, and you do your best thinking in stillness.',
    productivityTips: [
      'Protect your late-night peak: save deep work for your power hours',
      'Shift sleep gradually by 15 minutes every 3 days if you want to adjust',
      'Morning obligations? Prepare everything the night before — decision fatigue kills mornings',
      'Be aware: consistency in sleep timing matters more than total hours',
    ],
    color: '#818cf8',
    strengths: ['Deep focus in quiet', 'Creative thinking', 'Solitude productivity'],
  },
  EarlyBird: {
    archetype: 'The Early Bird',
    emoji: '🌅',
    tagline: 'You own the morning, you own the day',
    description: 'You harness the power of morning stillness. Your discipline and early start give you an edge that compounds over time.',
    productivityTips: [
      'Guard your first hour: no phone, no news — just your highest-priority task',
      'Create a morning ritual: the consistency trains your brain for deep work',
      'Use your energy peak wisely: schedule creative work before noon',
      'Plan tomorrow the night before — waking with a clear agenda multiplies output',
    ],
    color: '#fb923c',
    strengths: ['Discipline', 'Energy management', 'Morning momentum'],
  },
  BalancedAchiever: {
    archetype: 'The Balanced Achiever',
    emoji: '⚖️',
    tagline: 'You master the art of doing it all',
    description: 'Your browsing is diverse and intentional. You balance learning, work, news, and leisure — the mark of someone who builds a sustainable, rich life.',
    productivityTips: [
      'Keep monitoring your balance — it\'s your competitive advantage',
      'Add one new learning category each quarter to continue expanding',
      'Your balance is rare; protect it from work or entertainment creep',
      'Document your routines — what works now can guide you through harder seasons',
    ],
    color: '#34d399',
    strengths: ['Holistic thinking', 'Sustainability', 'Well-rounded perspective'],
  },
}

function getPeakHour(visits: PageVisit[]): string {
  if (!visits.length) return 'Unknown'
  const hourCounts: number[] = new Array(24).fill(0)
  for (const v of visits) {
    const h = new Date(v.startTime).getHours()
    hourCounts[h] += v.duration
  }
  const peak = hourCounts.indexOf(Math.max(...hourCounts))
  const label = peak === 0 ? '12am' : peak < 12 ? `${peak}am` : peak === 12 ? '12pm' : `${peak - 12}pm`
  return label
}

function getPeakPeriod(visits: PageVisit[]): 'early' | 'morning' | 'afternoon' | 'evening' | 'night' {
  if (!visits.length) return 'morning'
  const hourCounts: number[] = new Array(24).fill(0)
  for (const v of visits) hourCounts[new Date(v.startTime).getHours()] += v.duration
  const earlyMorning = hourCounts.slice(5, 9).reduce((s, v) => s + v, 0)
  const morning = hourCounts.slice(9, 13).reduce((s, v) => s + v, 0)
  const afternoon = hourCounts.slice(13, 18).reduce((s, v) => s + v, 0)
  const evening = hourCounts.slice(18, 22).reduce((s, v) => s + v, 0)
  const night = [...hourCounts.slice(22), ...hourCounts.slice(0, 5)].reduce((s, v) => s + v, 0)
  const periods = { earlyMorning, morning, afternoon, evening, night }
  const peak = Object.entries(periods).sort((a, b) => b[1] - a[1])[0][0]
  return peak as 'early' | 'morning' | 'afternoon' | 'evening' | 'night'
}

export function computeProfile(visits: PageVisit[]): CharacterProfile {
  if (!visits.length) {
    const base = ARCHETYPES['Explorer']
    return { ...base, dominantTrait: 'Exploring', peakHour: 'Unknown' }
  }

  const total = visits.reduce((s, v) => s + v.duration, 0)
  const byCategory: Record<string, number> = {}
  for (const v of visits) byCategory[v.category] = (byCategory[v.category] ?? 0) + v.duration

  const pct = (cat: string) => (byCategory[cat] ?? 0) / total

  const peakPeriod = getPeakPeriod(visits)
  const peakHour = getPeakHour(visits)

  let archetypeKey = 'Explorer'

  // Night/early bird overrides by timing
  if (peakPeriod === 'night') archetypeKey = 'NightOwl'
  else if (peakPeriod === 'early') archetypeKey = 'EarlyBird'
  // Category-dominant overrides
  else if (pct('Learning') >= 0.40) archetypeKey = 'Scholar'
  else if (pct('Work') >= 0.40) archetypeKey = 'Professional'
  else if (pct('Entertainment') >= 0.45) archetypeKey = 'Entertainer'
  else if (pct('Social Media') >= 0.30) archetypeKey = 'SocialConnector'
  else if ((pct('Finance') + pct('News')) >= 0.35) archetypeKey = 'Analyst'
  else if ((pct('Learning') + pct('Work')) >= 0.55) archetypeKey = 'Creator'
  else {
    // Balanced if no category dominates and productive score is decent
    const productivePct = pct('Learning') + pct('Work') + pct('Finance')
    const maxCatPct = Math.max(...Object.values(byCategory).map(v => v / total))
    if (maxCatPct < 0.35 && productivePct > 0.3) archetypeKey = 'BalancedAchiever'
  }

  const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Browsing'
  const base = ARCHETYPES[archetypeKey]
  return { ...base, dominantTrait: topCat, peakHour }
}
