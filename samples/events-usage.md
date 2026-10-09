# Event and $ API usage across the sample mods

Mods covered:
- Official playground samples: **TW** token-weather, **RT** replay-theater, **BR** blast-radius.
- Claude Code built-ins: **diff**, **AMD** agents-md, **SEC** sec-default, **TEL** telemetry.
- Community: **FP** fable-pin, **IP** image-peek (karanb192, shown for contrast).

The events come from `on('<event>' …)` in non-test sources and were cross-checked against `claude plugin validate`'s `hooks:` line. Numbers in a cell count registrations; filters are given in braces.

The reference declarations are `research/bundled-2.1.287/types/claude-code.d.ts` (2.1.287, 20,114 lines). Events are declared in three maps:
- `EngineEventOf` (line 3715): events the engine raises.
- `OpEventOf` (line 6382): every `$.noun.method` call, which is also hookable by name.
- `ClassicEventOf` (line 1077): `classic.<HookName>`.

Globs (`*`, `ns.*`, `!x`) are typed as `Glob` / `PatternOver` (lines 4725 and 6983).

## Event × mod matrix

| Event | Declared as | TW | RT | BR | diff | AMD | SEC | TEL | FP | IP |
|---|---|---|---|---|---|---|---|---|---|---|
| `engine.create` | engine | | | | | | | ✓ | | |
| `session.start` | engine | ✓ | ✓ | | ✓ | ✓ | | ✓ | ✓ | ✓ |
| `session.end` | engine | | | | | | | ✓ | | ✓ |
| `session.compact` | engine | | | | | | | | | ✓ |
| `turn.start` | engine | | ✓ | | | | | | | |
| `turn.complete` | engine | ✓ | ✓ | | | | | | | |
| `prompt.submit` | engine | | | | ✓ | | | | | |
| `prompt.context` | engine | | | | | ✓×2 `{instructionFiles:{kind}}` | ✓ | | | |
| `prompt.section` | engine | | | | | | ✓ | | | |
| `prompt.compose` | engine | | | | | | ✓ | | | |
| `prompt.edit` | engine | | | | | | | | | ✓ |
| `prompt.fill` | engine | | | | | | | | | ✓ |
| `skill.prompt` | engine | | | | | | ✓ | | | |
| `attribution.text` | engine | | | | | | ✓ | | | |
| `tool.call` | engine | | ✓ (all tools) | ✓ `{tool:"Bash"}` | ✓ `{tool:[edit+shell]}` | ✓ `{tool:'Read'}` | | | | |
| `tool.check` | engine | | | | | | ✓ | | | |
| `tool.describe` | engine | | | | | | ✓ | | | |
| `tool.list` | op (`$.tool.list`) | | | | | | ✓ | | | |
| `tool.register` | op (`$.tool.register`) | | | | | | ✓ | | | |
| `command.run` | engine | | ✓ `{command:"replay"}` | | ✓×2 `{command:'diff'}`, `{command:['clear','resume']}` | | | | ✓ | ✓ |
| `command.describe` | engine | | | | | | ✓ | | | |
| `agent.offer` | engine | | | | | | ✓ | | | |
| `agent.spawn` | engine | | | | | ✓ `{fork:true}` | ✓ | | ✓ | |
| `plugin.register` | engine | | | | | | ✓ `{tier:'user'}` | | | |
| `settings.read` | op (`$.settings.read`) | | | | | | ✓ | | | |
| `ui.render` | engine | ✓ AbovePrompt | ✓×2 AbovePrompt, Pane | ✓×2 Pane, AbovePrompt | ✓×2 PromptHint, Pane | | | | | ✓×2 AbovePrompt, Pane |
| `ui.close` | op (`$.ui.close`) | | ✓ | | ✓ `{id}` | | | | | ✓ `{id}` |
| `ui.focus` | engine | | | | ✓ `{plugin}` | | | | | |
| `ui.scroll` | engine | | | | ✓ `{requestId}` | | | | | |
| `telemetry.log` | engine (2.1.287) | | | | | | | ✓ | | |
| `telemetry.mark` | engine (2.1.287) | | | | | | | ✓ | | |
| `telemetry.*` | glob | | | | | | | ✓ | | |
| `classic.*` | glob over ClassicEventOf | | | | | | ✓ | | | |

Declared engine events that **no sample hooks**:
- `config.describe`, `config.set`
- `prompt.attachment`, `prompt.suggest`
- `session.append`, `session.attach`, `session.detach`, `session.measure`, `session.receive`, `session.send`
- `turn.step` (streaming)
- `ui.input`, `ui.message`, `ui.press`, `ui.resolve`, `ui.select`

No sample hooks any op event other than `ui.close`, `settings.read`, `tool.list` and `tool.register`. In particular, no sample intercepts `process.run`, `fs.*`, `model.*` or `http.fetch` raised by another plugin.

## $ API × mod matrix (from `claude plugin validate` `calls:`)

Only the nouns asked about are shown, plus `session`, `env`, `settings`, `prompt` and `telemetry`, which the samples lean on.

| Noun | TW | RT | BR | diff | AMD | SEC | TEL | FP | IP |
|---|---|---|---|---|---|---|---|---|---|
| `$.ui` | invalidate, resolve | open, close, invalidate, resolve | open, close, invalidate, resolve, toast | open, close, invalidate, log, resolve, status | log | log | log | | open, close, invalidate, log, panes, resolve |
| `$.state` | | | | | | | | | get, set |
| `$.store` | | | | get, set | | | | get, set | |
| `$.fs` | | exists, read | | list, read, stat | ancestors | | exists, list, read | | |
| `$.process` | | | run | run | | | run | | run |
| `$.clock` | | sleep | now | after, every, now | | | after, sleep | | every |
| `$.command` | | register | | register | | | | register | register |
| `$.model` | | | | | | | | | |
| `$.agent` | | | | | | | | | |
| `$.tool` | | | | | | | | | |
| `$.audio` | | | | | | | | | |
| `$.session` | usage | cwd | cwd | id, messages, usage | cwd, root | | authorize, cwd, id, model, repo, surfaces, version | | id |
| `$.env` | | | | get | get | | get | | get |
| `$.settings` | | | | read | | read | read | | |
| `$.prompt` | | | | | | | | | read |
| `$.http` | | | | | | | fetch | | |
| `$.telemetry` | | | | log, mark | log, mark | | (implements it) | | |

**Gaps worth knowing:** none of the official or built-in samples call `$.model`, `$.agent`, `$.audio`, `$.tool`, `$.state`, `$.fs.write`, `$.process.spawn`, `$.mcp.*` or `$.ui.ask/notice/blit/copy`. Only one community sample uses `$.state` (image-peek). An illustration that needs those APIs has to rely on the d.ts docs, not on a sample.

## Events and APIs in the samples that are NOT in the 2.1.287 declarations

**Result: none in mod source.** Every event and every `$.noun.method` that the nine mods use resolves in the local 2.1.287 `claude-code.d.ts`. The same holds for the UI elements `Box`, `Text`, `Button`, `Select`, `Code` and `Image` (`Elements`, line 3577), the render components `AbovePrompt`, `Pane` and `PromptHint` (`RenderComponent`, line 8681), and the `next.signal`, `next.origin`, `next.trace` and `next.to` members.

Near-misses and caveats:

1. **Version skew in the upstream types file.** `upstream/claude-code/mods/types/claude-code.d.ts` was written by **2.1.277**. Compared with local 2.1.287:
   - Engine events new in 2.1.287: `session.append`, `session.send`, `telemetry.log`, `telemetry.mark`.
   - Op events new in 2.1.287: `mcp.connect`, `process.spawn`, `state.get`, `state.set`, `ui.copy`.
   - So the built-in **telemetry** mod hooks `telemetry.log`/`telemetry.mark`, which are not engine events in the 2.1.277 file it ships beside. It covers this with its own `telemetry/types/index.d.ts`, which declares `$.telemetry` (the validator reports "types ./types/index.d.ts declares on $: $.telemetry").
   - **image-peek**'s `$.state.get/set` would also not type-check against 2.1.277.
2. **Test-only `$` calls.** Test files call things that are not on `CoreEngineInterface`: `$.ui.mount`, `$.ui.press`, and engine events dispatched through `$` such as `$.session.start`, `$.command.run`, `$.ui.render`, `$.turn.complete`, `$.prompt.context`, `$.agent.offer`, `$.tool.describe` and `$.session.end`. These are declared in the separate `declare module 'claude-code/testing'` block (line 13843; `mount` at 14054, `press` at 14089), not as runtime APIs.
3. **`next.to(e, 'append')`** (sec-default) is listed by the validator as a "call" but is a `Next` member (`readonly to:` at line 4750), not a `$` noun.
4. **`beneath.*`** (telemetry): at `engine.create`, `$` is the empty table (`NoEngineInterface`). The mod uses the `$` that `await next(e)` returns (`EngineInterfaceBuilt`, line 4204). The validator still attributes those calls to `$.http.fetch` and the others.
5. **`$.NS…` in image-peek** (`$.NSPasteboard…`, `$.NSUUID…`) is JXA ObjC-bridge code inside a string run by `osascript`, not the mod `$`. The validator correctly ignores it.
6. **Community nouns outside the core API**, seen in the awesome-list scan and not in any sample here: `$.sidebar.*`, `$.gemini.*`, `$.flow.*`, `$.runtime.*`, `$.ruflo.*`, `$.spare10.*`, `$.fs.remove`, `$.stat`. These are either plugin-declared nouns (added through `engine.create` plus a `declare module 'claude-code' { interface EngineInterface { … } }` types file) or calls that do not exist.
7. **Doc-only claim, not in d.ts:** mod-builder's `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` gate (see CATALOG.md §C).
