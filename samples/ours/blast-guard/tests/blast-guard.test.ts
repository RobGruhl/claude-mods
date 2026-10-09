import { expect, test } from 'claude-code/testing'

test('holds rm -rf and force pushes, passes the rest trimmed', async ($, on) => {
  const ran: string[] = []
  on('tool.call', (_$, e) => {
    if (e.tool === 'Bash') ran.push(e.command)
    return { result: { stdout: '', stderr: '', interrupted: false } } as never
  })

  const held = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(JSON.stringify(held)).toContain('destructive')
  const pushed = await $.tool.call({ tool: 'Bash', command: 'git push --force origin main' })
  expect(JSON.stringify(pushed)).toContain('destructive')

  await $.tool.call({ tool: 'Bash', command: '  ls -la  ' })
  expect(ran).toEqual(['ls -la'])
})
