export type Tally = { sessions: number; turns: number; tools: number }

declare module 'claude-code' {
  interface PluginState {
    ledger: { session: Tally; allTime: Tally }
  }
}
