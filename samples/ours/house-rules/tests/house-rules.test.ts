import { expect, mock, test } from 'claude-code/testing'

const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const

test('adds its section after the engine’s', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections.map(s => s.id)).toEqual(['intro', 'house-rules:rules'])
})

test('attaches the submit time as context the person never sees', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 3, 9, 0) })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  const sent = await $.prompt.submit({ text: 'hello' } as never)
  expect(sent.context).toEqual(['Submitted at 2026-10-03T09:00:00.000Z.'])
})

test('answers /house-rules', async ($, on) => {
  on('command.register', () => undefined as never)
  const out = await $.command.run({ command: 'house-rules', args: '' } as never)
  expect(out.text).toContain('House rules')
})
