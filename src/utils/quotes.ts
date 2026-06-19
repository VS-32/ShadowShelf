export interface Quote {
  text: string
  author: string
}

const QUOTES: Quote[] = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "Productivity is never an accident. It is always the result of a commitment to excellence.", author: "Paul J. Meyer" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "One hour of focused work is worth more than four hours of distraction.", author: "Cal Newport" },
  { text: "Attention is the rarest and purest form of generosity.", author: "Simone Weil" },
  { text: "Almost everything will work again if you unplug it for a few minutes — including you.", author: "Anne Lamott" },
  { text: "Rest is not idleness. It is the key to greater activity.", author: "John Lubbock" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
  { text: "Energy, not time, is the fundamental currency of high performance.", author: "Tony Schwartz" },
  { text: "Knowledge is power only if you put it to use.", author: "Dale Carnegie" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Augusta F. Kantra" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "Your mind is for having ideas, not holding them.", author: "David Allen" },
  { text: "You get what you focus on, so focus on what you want.", author: "Unknown" },
  { text: "Work expands to fill the time available for its completion.", author: "Cyril Northcote Parkinson" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "The more you learn, the more you earn.", author: "Warren Buffett" },
  { text: "Invest in yourself. Your career is the engine of your wealth.", author: "Paul Clitheroe" },
  { text: "Excellence is not a destination but a continuous journey.", author: "Brian Tracy" },
  { text: "You don't rise to the level of your goals; you fall to the level of your systems.", author: "James Clear" },
  { text: "Clarity about what matters most provides the foundation for excellent decisions.", author: "Cal Newport" },
  { text: "The greatest enemy of good thinking is busyness.", author: "John C. Maxwell" },
  { text: "Sleep is the single most effective thing we can do to reset our brain.", author: "Matthew Walker" },
  { text: "Take breaks regularly to achieve sustainable high performance.", author: "Tony Schwartz" },
  { text: "It's not about having time. It's about making time.", author: "Unknown" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "The mind, once stretched by a new idea, never returns to its original dimensions.", author: "Ralph Waldo Emerson" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "Move fast, but never hurry.", author: "John Wooden" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Focused, hard work is the real key to success.", author: "John Carmack" },
  { text: "Deep work is the superpower of the 21st century.", author: "Cal Newport" },
  { text: "Every morning you have two choices: continue to sleep with your dreams or wake up and chase them.", author: "Unknown" },
  { text: "Your attention is your most valuable asset. Spend it wisely.", author: "Unknown" },
  { text: "The present moment is the only moment available to us.", author: "Thich Nhat Hanh" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "Awareness is the greatest agent for change.", author: "Eckhart Tolle" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
]

export function getDailyQuote(): Quote {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400_000)
  return QUOTES[dayOfYear % QUOTES.length]
}

export function getQuoteForSession(): Quote {
  const key = Math.floor(Date.now() / (3600_000)) % QUOTES.length
  return QUOTES[key]
}
