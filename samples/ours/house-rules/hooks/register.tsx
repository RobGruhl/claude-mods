import type { Register } from 'claude-code'

// BEFORE a turn. Three places a mod can shape what the model reads before it answers:
// the system prompt (prompt.compose), the prompt itself (prompt.submit), and a slash command.

const RULES = 'House rules: prefer small diffs, say which files you changed, and never commit unless asked.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'house-rules', description: 'Show the rules this mod adds to the system prompt' })
    return next(e)
  })

  on('command.run', { command: 'house-rules' }, () => ({ text: RULES }))

  // The system prompt: append one section after the cache boundary ('session' scope).
  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    return { sections: [...sections, { id: 'house-rules:rules', text: RULES, scope: 'session' as const }] }
  })

  // The prompt: attach context the model reads and the person never sees.
  on('prompt.submit', async ($, e, next) => {
    const now = new Date(await $.clock.now()).toISOString()
    return next({ ...e, context: [...(e.context ?? []), `Submitted at ${now}.`] })
  })
}
