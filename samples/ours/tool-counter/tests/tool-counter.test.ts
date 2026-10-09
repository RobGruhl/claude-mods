import { expect, test } from 'claude-code/testing'

test('shows the running count in the status line', async ($, on) => {
  const shown: unknown[] = []
  on('ui.status', (_$, e) => (shown.push(e.text), { value: undefined }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })
  expect(shown).toEqual(['Tool calls so far: 1', 'Tool calls so far: 2'])
})
