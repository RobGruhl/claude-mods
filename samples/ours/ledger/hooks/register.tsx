import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Tally } from '../types'

// DURABLE. Three lifetimes side by side:
//   a module variable dies at every hot reload;
//   $.state (the atoms) lives for the session and redraws whoever read it, but /clear, /resume
//   and /branch reset it to its default without firing session.start again;
//   $.store is a JSON file of this plugin's own and outlives the session.
// So $.store is the source of truth: every write starts from what is stored, never from $.state.

const ZERO: Tally = { sessions: 0, turns: 0, tools: 0 }
const KEY = 'all-time'
const session = atom({ plugin: 'ledger', key: 'session' } as const, ZERO)
const allTime = atom({ plugin: 'ledger', key: 'allTime' } as const, ZERO)

async function stored($: EngineInterface): Promise<Tally> {
  return ((await $.store.get(KEY)) as Tally | undefined) ?? ZERO
}

async function bump($: EngineInterface, field: keyof Tally) {
  if (field !== 'sessions') await update($, session, t => ({ ...t, [field]: t[field] + 1 }))
  const before = await stored($)
  const total = { ...before, [field]: before[field] + 1 }
  await $.store.set(KEY, total)
  await update($, allTime, () => total)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await bump($, 'sessions')
    return next(e)
  })

  // After /clear, /resume or /branch the $.state values are back at their defaults and
  // session.start does not fire; the classic SessionStart event does, so reload from the store.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume' || e.source === 'fork') {
      const total = await stored($)
      await update($, allTime, () => total)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await bump($, 'tools')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await bump($, 'turns')
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const now = await read($, session)
    const ever = await read($, allTime)
    if (e.props.hasSurvey || ever.sessions === 0) return next(e)
    const { Text } = $.ui.resolve(e)
    return (
      <Text dimColor>
        ledger · this session {now.turns} turns, {now.tools} tools · all time {ever.turns} turns over {ever.sessions} sessions
      </Text>
    )
  })
}
