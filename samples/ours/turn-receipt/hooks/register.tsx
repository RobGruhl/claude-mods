import type { Register } from 'claude-code'

// AFTER a turn. turn.complete fires when the answer is in; a different { text } is shown
// beneath the answer, and the transcript's record is never rewritten.

export const register: Register = on => {
  let startedAt = 0
  let tools = 0

  on('turn.start', async ($, e, next) => {
    startedAt = await $.clock.now()
    tools = 0
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    tools += 1
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.reason !== 'answer') return done
    const seconds = Math.round(((await $.clock.now()) - startedAt) / 1000)
    const out = done.usage?.output_tokens
    return { ...done, text: `receipt: ${seconds}s, ${tools} tool call${tools === 1 ? '' : 's'}${out ? `, ${out} output tokens` : ''}` }
  })
}
