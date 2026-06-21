chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'PLAY_TIMER_SOUND') return
  playChime().then(() => {
    chrome.runtime.sendMessage({ type: 'OFFSCREEN_DONE' }).catch(() => {})
  })
  sendResponse({ ok: true })
  return true
})

async function playChime() {
  const ctx = new AudioContext()

  // G major ascending arpeggio: G4 → B4 → D5 → G5
  const notes = [
    { hz: 392.0, t: 0.00, dur: 0.55 },
    { hz: 493.9, t: 0.18, dur: 0.55 },
    { hz: 587.3, t: 0.36, dur: 0.55 },
    { hz: 784.0, t: 0.54, dur: 1.00 },
  ]

  const master = ctx.createGain()
  master.gain.value = 0.55
  master.connect(ctx.destination)

  for (const { hz, t, dur } of notes) {
    // Primary sine tone
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = hz
    osc.connect(env)
    env.connect(master)

    // Octave harmonic for warmth
    const osc2 = ctx.createOscillator()
    const env2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.value = hz * 2
    osc2.connect(env2)
    env2.connect(master)

    const at = ctx.currentTime + t
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(0.45, at + 0.012)
    env.gain.exponentialRampToValueAtTime(0.001, at + dur)

    env2.gain.setValueAtTime(0, at)
    env2.gain.linearRampToValueAtTime(0.10, at + 0.012)
    env2.gain.exponentialRampToValueAtTime(0.001, at + dur * 0.4)

    osc.start(at);  osc.stop(at + dur + 0.05)
    osc2.start(at); osc2.stop(at + dur * 0.4 + 0.05)
  }

  return new Promise(resolve => setTimeout(resolve, 1900))
}
