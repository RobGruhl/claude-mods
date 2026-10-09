# Claude Mods

Notes, samples and diagrams for Claude Code's mods: TypeScript or JavaScript plugins that hook the engine's own event chain. Mods shipped on 1 October 2026 in v2.1.287. Last checked against Claude Code 2.1.295 on 2026-10-08. This is an independent study, not an Anthropic project. The API is early access, so check anything here against the types your own build writes.

## What's here

- `infographics/101.html`: **Claude Mods 101**, a beginner's walk in ten lessons that explains every term as it comes up. Open it in a browser.
- `infographics/index.html`: **Claude Mods Anatomy**, the full illustrated guide, covering anatomy, the hook chain, before/during/after, a tool call end to end, what lasts how long, where a mod draws, mods next to hooks, skills and MCP, admin controls, and samples.
- `research/architecture-notes.md`: a synthesis organised by lifecycle phase, marking each claim as documented, inferred or a discrepancy. Its citation keys name the official pages and bundled files listed below.
- `research/update-2026-10-08.md`: what changed from 10/3 to 10/8: releases 2.1.288 to 2.1.295 and the new community catalogs, each claim marked checked or unchecked.
- `samples/CATALOG.md` and `samples/events-usage.md`: what each upstream mod hooks and calls, and an event-by-mod matrix.
- `samples/ours/`: five small mods: `tool-counter`, the 101's first mod, and four for the guide, one per phase.

### Kept locally, not in this repo

These are Anthropic's or other people's work, so they're ignored by git. The notes cite them by these paths.

- `research/bundled-<version>/`: the material bundled with Claude Code: the `plugin-authoring` skill's long-form `reference.md`, its example modules, and `types/claude-code.d.ts` (about 21,500 lines in 2.1.295; 46 engine events, up from 43 in 2.1.287). To get your own copy, load the `plugin-authoring` skill in Claude Code and copy from the `bundled-skills/<version>/plugin-authoring/` folder it names. The type-check configs in `samples/ours/.typecheck/` expect it at `research/bundled-2.1.295/`.
- `research/docs/`: copies of the official mods docs (overview, reference, create, interface, events, api, admin, test, troubleshoot, gallery), the launch post, the getting-started post and the release notes. Read them at https://code.claude.com/docs/en/plugins/mods/overview.
- `samples/upstream/`: shallow clones of `anthropics/claude-code-playground`, `anthropics/claude-code` (sparse: `mods/`), `karanb192/claude-code-mods` and `karanb192/awesome-claude-code-mods`.

## The four samples

| Phase | Mod | Hooks |
| --- | --- | --- |
| Before | `house-rules` | `prompt.compose` adds a system-prompt section; `prompt.submit` attaches hidden context; `/house-rules` |
| During | `blast-guard` | `tool.call` denies destructive Bash and trims the rest; `agent.spawn` pins Explore to Haiku |
| After | `turn-receipt` | `turn.complete` prints a one-line receipt beneath each answer |
| Durable | `ledger` | `$.state` for this session, `$.store` for all time, reload after `/clear` via `classic.SessionStart`, an AbovePrompt band |

Each one passes `claude plugin validate`, type-checks with `tsc` against the 2.1.295 declarations (configs in `samples/ours/.typecheck/`), and passes `claude plugin test` (9 tests across the five mods), last checked on 2.1.295.

To try one for a single session, without installing it:

```
claude --plugin-dir samples/ours/turn-receipt
```

`blast-guard` is a teaching sample, not a safety control. Mod guards fail open when a hook throws or overruns.

## Things learned the hard way

- `/clear`, `/resume` and `/branch` reset every `$.state` value to its default and don't fire `session.start`. A mod that mirrors `$.store` into `$.state` must reload in a `classic.SessionStart` hook, or its next write saves the default over the stored value. `ledger` had this bug until the docs pointed it out.
- `claude plugin validate` refuses a module that passes `$` to anything but a top-level function declared in the same file.
- In `claude plugin test`, nothing sits beneath the plugin. A test must answer every event and `$` call the mod makes (`mock.clock`, `mock.store`, or its own `on('store.get', …)` returning `{ value }`). The kit refuses two hooks on the same event from the test.
- Plugin names that look like Anthropic's (for example a `claude-` prefix) fail validation.

## License

MIT, see `LICENSE`. This covers what's in this repo, not the locally kept material listed above.
