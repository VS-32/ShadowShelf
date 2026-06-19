import type { Category } from '../types'

const rules: { pattern: RegExp; category: Category }[] = [
  // Learning
  { pattern: /github\.com|stackoverflow\.com|developer\.|docs\.|learn\.|tutorial|coursera|udemy|edx|khanacademy|w3schools|mdn|freecodecamp|geeksforgeeks|leetcode|hackerrank|pandas|numpy|pytorch|tensorflow|arxiv\.org|wikipedia\.org|medium\.com|dev\.to|hashnode|towardsdatascience/, category: 'Learning' },
  // Work
  { pattern: /linkedin\.com|slack\.com|notion\.so|trello\.com|jira|asana\.com|monday\.com|confluence|zoom\.us|teams\.microsoft|figma\.com|gitlab|bitbucket|vercel|netlify|heroku|aws\.amazon|cloud\.google|azure\.microsoft|powerbi/, category: 'Work' },
  // Entertainment
  { pattern: /youtube\.com|netflix\.com|primevideo|hotstar|spotify\.com|twitch\.tv|hulu\.com|disneyplus|reddit\.com|9gag|imgur|tiktok|anime|manga|steam\.com|epicgames|xbox|playstation/, category: 'Entertainment' },
  // Social Media
  { pattern: /facebook\.com|instagram\.com|twitter\.com|x\.com|snapchat|pinterest|tumblr|whatsapp|telegram\.org|discord\.com|threads\.net|mastodon/, category: 'Social Media' },
  // Shopping
  { pattern: /amazon\.|flipkart\.com|myntra\.com|meesho|ebay\.com|etsy\.com|walmart|target\.com|shopify|swiggy|zomato|blinkit|zepto|nykaa|ajio/, category: 'Shopping' },
  // Finance
  { pattern: /zerodha|groww\.in|upstox|angelone|kuvera|paytm|phonepe|googlepay|razorpay|icicibank|hdfcbank|sbibank|kotak|axisbank|bankofbaroda|moneycontrol|economictimes\.com|nseindia|bseindia|mutualfund|emi|loan|insurance/, category: 'Finance' },
  // News
  { pattern: /bbc\.com|cnn\.com|ndtv\.com|thehindu\.com|hindustantimes|timesofindia|indianexpress|theguardian|nytimes|washingtonpost|reuters\.com|apnews|bloomberg|techcrunch|theverge|wired\.com|engadget|arstechnica/, category: 'News' },
]

export function categorize(url: string, title: string): Category {
  const combined = `${url} ${title}`.toLowerCase()
  for (const { pattern, category } of rules) {
    if (pattern.test(combined)) return category
  }
  return 'Other'
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function computeFocusScore(breakdown: Record<string, number>): number {
  const productive = (breakdown['Learning'] ?? 0) + (breakdown['Work'] ?? 0) + (breakdown['Finance'] ?? 0)
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0)
  if (total === 0) return 0
  return Math.min(100, Math.round((productive / total) * 100))
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
