import { expect, test } from 'claude-code/testing'

import type { On } from 'claude-code'

// A store in memory that remembers what was written: last time left 4 sessions, 30 turns, 120 tools.
function world(on: On) {
  const disk = new Map<string, unknown>([['all-time', { sessions: 4, turns: 30, tools: 120 }]])
  on('store.get', (_$, e) => ({ value: disk.get(e.key) }))
  on('store.set', (_$, e) => (disk.set(e.key, e.value), { value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('classic.SessionStart', () => ({}) as never)
  return disk
}

const TURN = { answer: 'ok', durationMs: 5, isAborted: false, turnId: 't', reason: 'answer' } as const

test('carries all-time totals across sessions in $.store', async ($, on) => {
  const disk = world(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.complete(TURN)
  expect(disk.get('all-time')).toEqual({ sessions: 5, turns: 31, tools: 121 })
})

test('a /clear does not write zeros over the stored totals', async ($, on) => {
  const disk = world(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.classic.SessionStart({ source: 'clear' } as never)
  await $.turn.complete(TURN)
  expect(disk.get('all-time')).toEqual({ sessions: 5, turns: 31, tools: 120 })
})
