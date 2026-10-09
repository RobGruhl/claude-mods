import type { Register } from 'claude-code'

export const register: Register = on => {
  let count = 0

  on('tool.call', ($, e, next) => {
    count += 1
    $.ui.status(`Tool calls so far: ${count}`)
    return next(e)
  })
}
