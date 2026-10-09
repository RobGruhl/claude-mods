import { expect, mock, test } from 'claude-code/testing'

test('prints a receipt beneath an answered turn', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)
  on('turn.complete', (_$, e) => ({ text: e.answer }))

  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(42_000)
  const done = await $.turn.complete({ answer: 'done', durationMs: 42_000, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(done.text).toBe('receipt: 42s, 1 tool call')
})

test('leaves an interrupted turn alone', async ($, on) => {
  mock.clock(on)
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  const done = await $.turn.complete({ answer: 'partial', durationMs: 1, isAborted: true, turnId: 't2', reason: 'aborted' })
  expect(done.text).toBe('partial')
})
