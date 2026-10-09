import type { Register } from 'claude-code'

// DURING a turn. tool.call sits in front of every tool: a hook can refuse it ({ deny }),
// rewrite it (next({ ...e })), or let it run and act on the result (await next(e)).

const DESTRUCTIVE = [/\brm\s+-[a-z]*r[a-z]*f\b|\brm\s+-[a-z]*f[a-z]*r\b/, /\bgit\s+push\b.*(--force\b|\s-f\b)/, /\bgit\s+reset\s+--hard\b/]

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const hit = DESTRUCTIVE.find(re => re.test(e.command))
    if (hit) {
      $.ui.toast(`blast-guard held: ${e.command.slice(0, 60)}`)
      return { deny: `${$.plugin.name}: "${e.command}" is destructive; ask the person to run it themselves.` }
    }
    const ran = await next({ ...e, command: e.command.trim() })
    $.ui.status(ran.deny === undefined && ran.isError === true ? `failed: ${e.command.slice(0, 40)}` : undefined)
    return ran
  })

  // Subagents: everything is decided except the model; answer with a different one.
  on('agent.spawn', async ($, e, next) => (e.subagentType === 'Explore' ? next({ ...e, model: 'haiku' }) : next(e)))
}
