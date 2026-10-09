# Claude Mods sample catalog

Collected 2026-10-03 as read-only reference. Nothing here is installed or enabled.
All clones are `git clone --depth 1` under `upstream/`.

| Clone | Commit | Date | Notes |
|---|---|---|---|
| `upstream/claude-code-playground` | `569c528` | 2026-10-01 | Official DevRel samples in `claude-code/mods/` (token-weather, replay-theater, blast-radius). The `add-mods` branch is already merged into `main`. |
| `upstream/claude-code` | `1c229fc` | 2026-10-02 | Sparse checkout of `mods/` only (blobless clone). Built-in mods: diff, agents-md, sec-default, telemetry; plus `mods/types/claude-code.d.ts` (**written by 2.1.277**, 13,186 lines, compared with the local 2.1.287 file at 20,114 lines). |
| `upstream/claude-code-mods` | `c7724a8` | 2026-10-03 | karanb192: `plugins/mod-builder` (a skill, not a mod), `plugins/fable-pin`, `plugins/image-peek`. `plugins/cache-tax` is only a README pointing to a separate repo. |
| `upstream/awesome-claude-code-mods` | `fe528a2` | 2026-10-03 | Curated README plus a nightly scanner dump `data/mods.json` (1,014 mods from 869 repos, validated with Claude Code 2.1.288). |

**What was requested and found:** everything. All four repos and every named path exist.
**Not present:** the playground mods are not in the awesome-list scan (`data/mods.json` has no `anthropics/claude-code-playground` entries). The upstream `mods/types/claude-code.d.ts` is older (2.1.277) than the local research copy (2.1.287).

How the "events" and "$ APIs" columns below were produced:
- **Events**: a multi-line regex over every non-test `.ts`/`.mjs`/`.js` source for `on('<event>'[, {filter}]`. These were then checked against the `hooks:` line that `claude plugin validate` printed (2.1.288). They agree.
- **$ APIs**: taken from the validator's `calls:` line. It follows aliases, for example telemetry's `beneath.http.fetch` and diff's `host` wrapper, which a plain `grep '\$\.'` misses. Comment-only mentions are excluded. For example, sec-default mentions `$.tool.list` only in a comment.
- **Line counts**: non-test source lines, excluding `.d.ts`. Test lines are listed separately.

---

## A. Official sample mods (anthropics/claude-code-playground, `claude-code/mods/`)

Each is a single plain-JS `.mjs` module named in `hooks/hooks.json` under `"modules"`. Each has a README and screenshots and no tests. They need Claude Code 2.1.287 or later, "where mods load by default" (playground README).

### A1. token-weather — `upstream/claude-code-playground/claude-code/mods/token-weather/hooks/token-weather.mjs`

**Lines:** 122 (1 file, no tests).
**What it does:** Draws one "weather forecast" line for the context window above the prompt: an icon and word (Clear, Cloudy, Showers, Storm, "Compact soon") chosen by fill percentage, the percentage, tokens used out of the window, a block-character sparkline of the last 12 turns, and a ▲/▼ trend. It takes a reading at `session.start` and after every main-loop `turn.complete`, skipping subagent turns by checking `e.agentId`, then calls `$.ui.invalidate("ui.render")` so the band redraws. Its state lives in a module-level array, so nothing survives a restart. It is the smallest complete mod in the set and the clearest AFTER plus render example.
**Events:** `session.start`, `turn.complete`, `ui.render {component:"AbovePrompt"}`.
**$ APIs:** `$.session.usage`, `$.ui.invalidate`, `$.ui.resolve`. It does not use state, store, fs, process, model, agent, clock, tool, command or audio.
**ui.render components:** AbovePrompt band. Elements: `Box`, `Text`.
**Key lines:** 40–47 (`await next(e)` first, then read: AFTER), 49–55 (band render that falls back to `next(e)` when `e.hasSurvey` or no data), 72 (`$.ui.invalidate`).

### A2. replay-theater — `upstream/claude-code-playground/claude-code/mods/replay-theater/hooks/replay-theater.mjs`

**Lines:** 249 (1 file, no tests).
**What it does:** Records every `Edit`, `Write` and `MultiEdit` call during a turn as a diff step without blocking the call. For `Write` it reads the file's prior contents with `$.fs.read` so the diff is real. At the end of a main-loop turn the recorded steps become the "replay". A band above the prompt then shows "▶ Replay: N edits (press r)" with a Replay button, and `/replay` opens a focused 58-column Pane with Prev, Next and Close buttons that steps through one LCS-diff at a time. When the surface cannot place a pane (`isPlaced === false`, a narrow terminal), the same view is drawn in the AbovePrompt band. It hooks `ui.close` to keep its open flag in sync when Escape closes the pane. It registers the slash command at `session.start`. All state is module-level, so nothing persists.
**Events:** `session.start`, `command.run {command:"replay"}`, `tool.call` (unfiltered, observe-only), `turn.start`, `turn.complete`, `ui.render {component:"AbovePrompt"}`, `ui.render {component:"Pane"}`, `ui.close`.
**$ APIs:** `$.command.register`, `$.fs.exists`, `$.fs.read`, `$.session.cwd`, `$.clock.sleep`, `$.ui.open`, `$.ui.close`, `$.ui.invalidate`, `$.ui.resolve`. It does not use state, store, process, model, agent, tool or audio.
**ui.render components:** AbovePrompt band and Pane (`requestId === "replay-theater"`). Elements: `Box`, `Text`, `Button` (with `hotkey`, `autoFocus`, `onPress`).
**Key lines:** 196–204 (DURING: record, then `return next(e)`, and "recording must never stop the edit"), 206–209 (`turn.start` resets per turn), 212–221 (AFTER: `await next(e)` then promote pending to replay), 109–123 (`$.ui.open({... focus:true, closeOnEscape:true})` with band fallback), 243–248 (`ui.close`).

### A3. blast-radius — `upstream/claude-code-playground/claude-code/mods/blast-radius/hooks/blast-radius.mjs`

**Lines:** 528 (1 file, no tests).
**What it does:** Intercepts risky `Bash` calls before they run: `rm -r`/`-f`, `git reset --hard`, `git clean`, force-push, `git checkout/restore -- .`, and migrations (alembic, rails, prisma, Django, generic). It parses the command line through `cd`/`pushd`/subshell/`git -C` to find the effective directory. It then measures the blast radius with read-only dry runs through `$.process.run`: `find`/`du` for rm, `git clean -n`, `git status --porcelain` plus `git diff --shortstat`, `git log src..remote` for force-push, and the migration tool's status command. It shows the result in a yellow Pane, or a band when the pane cannot be placed, with Proceed and Cancel buttons. It **holds the tool call** until a button is pressed by polling `$.process.run(["sleep","0.25"])`. Time spent inside a `$` call does not count against the hook's 10-second budget. It gives up after 10 minutes or on `next.signal.aborted`. Proceed calls `next(e)` and the command runs. Anything else returns `{ deny: "... Do not retry it unless the user asks you to." }`, so the model sees the reason. It allows one hold at a time.
**Events:** `tool.call {tool:"Bash"}`, `ui.render {component:"Pane"}`, `ui.render {component:"AbovePrompt"}`.
**$ APIs:** `$.process.run` (13 call sites), `$.session.cwd`, `$.clock.now`, `$.ui.open`, `$.ui.close`, `$.ui.invalidate`, `$.ui.resolve`, `$.ui.toast`. It does not use state, store, fs, model, agent, tool, command or audio.
**ui.render components:** Pane (`requestId === "blast-radius"`) and AbovePrompt fallback. Elements: `Box`, `Text` (nested Text children), `Button` (`plain`, `hotkey`, `autoFocus` on Cancel).
**Key lines:** 27–31 (BEFORE: filtered `tool.call`, pass-through when not risky), 57–74 (DURING: open pane, then the hold loop on `$.process.run sleep` with `next.signal.aborted` and a timeout), 94–106 (verdict: `return next(e)` or `{ deny }`), 500–504 (`onPress` sets the decision on the captured `state`, not the global).

### `claude plugin validate` (Claude Code 2.1.288) on the official samples

```
token-weather   ✔ Validation passed (exit 0)
  hooks: session.start, turn.complete, ui.render{component=AbovePrompt}
  calls: $.session.usage (via takeReading), $.ui.invalidate (via takeReading), $.ui.resolve

replay-theater  ✔ Validation passed (exit 0)
  hooks: session.start, command.run{command=replay}, tool.call, turn.start, turn.complete,
         ui.render{component=AbovePrompt}, ui.render{component=Pane}, ui.close
  calls: $.clock.sleep (via openReplay), $.command.register, $.fs.exists (via stepsFor),
         $.fs.read (via stepsFor), $.session.cwd (via stepsFor), $.ui.close (via replayView),
         $.ui.invalidate, $.ui.open (via openReplay), $.ui.resolve

blast-radius    ✔ Validation passed (exit 0)
  hooks: tool.call{tool=Bash}, ui.render{component=Pane}, ui.render{component=AbovePrompt}
  calls: $.clock.now, $.process.run, $.session.cwd, $.ui.close, $.ui.invalidate, $.ui.open,
         $.ui.resolve, $.ui.toast
```

---

## B. Claude Code built-in mods (anthropics/claude-code, `mods/`)

These are TypeScript, one function per file, with `register.ts` as the entry, `import type { On } from 'claude-code'`, and a `tests/` folder run by `claude plugin test`. The mods README says "These four ship inside Claude Code; this folder is their source, published as it is built into the binary."

### B1. diff — `upstream/claude-code/mods/diff/`

**Lines:** 8,247 source in 570 files (entry `hooks/register.ts`: 1,036). Tests: 7,693 lines in 227 files.
**What it does:** `/diff` is reimplemented as a plugin. It opens a Pane beside the transcript listing the session's uncommitted changes file by file with hunks, and refreshes as Claude edits files or runs shell commands. While open it polls `HEAD` on a clock (`$.clock.every`). The main loop's first successful edit auto-opens the pane when the terminal is wide enough and checkpointing is on. It follows the focus ring (`ui.focus`), handles its own wheel scrolling (`ui.scroll`), and forgets cached repo state on `/clear` or `/resume`. You can compare against session-start HEAD, plain HEAD or merge-base, or view one earlier turn's edits read from `$.session.messages()`. Lockfiles and generated files are folded. A per-file "ask" button arms that file's hunks to ride the next prompt as context: `prompt.submit` rewrites `e.context`. Its preferences are persisted per repository in `$.store`. It sends usage telemetry through `$.telemetry`.
**Events:** `session.start`, `ui.render {component:'PromptHint'}`, `ui.render {component:'Pane'}`, `command.run {command:'diff'}`, `command.run {command:['clear','resume']}`, `ui.close {id:PANE_ID}`, `ui.focus {plugin:PLUGIN_NAMES}`, `ui.scroll {requestId:PANE_ID}`, `tool.call {tool:[...EDITING_TOOLS, ...SHELL_TOOLS]}`, `prompt.submit`.
**$ APIs (validator):** `$.clock.after/every/now`, `$.command.register`, `$.env.get`, `$.fs.list/read/stat`, `$.process.run`, `$.session.id/messages/usage`, `$.settings.read`, `$.store.get/set`, `$.telemetry.log/mark`, `$.ui.open/close/invalidate/log/resolve/status`. Nearly all are bound once in `session.start` (register.ts 656–691) into a `host` object that later hooks, timers and presses use.
**ui.render components:** Pane (main view) and PromptHint (used only to measure `e.viewport` columns and fullscreen, then `return next(e)`). Elements: `Box`, `Text`, `Button`, `Select`, `Code` (register.ts 727).
**Key lines:** register.ts 971–987 (AFTER: `try { result = await next(e) } finally { afterTool(...) }`), 989–1035 (BEFORE: `prompt.submit` → `next({ ...e, context: [...context, text] })`), 813 and 586 (DURABLE: `host.storeSet(Names.STORE_OPEN_KEY, …)` and the per-repo base key).

### B2. agents-md — `upstream/claude-code/mods/agents-md/`

**Lines:** 1,070 source in 56 files (entry `hooks/register.ts`: 305). Tests: 370 lines in 16 files.
**What it does:** Loads `AGENTS.md` as project instructions, controlled by the plugin option `instructionFiles`:
- `claude-md-or-agents-md` (default): use AGENTS.md only where the project has no CLAUDE.md.
- `claude-md-and-agents-md`: load AGENTS.md beside CLAUDE.md.
- `managed-only`: drop the project's and the user's instruction files, keeping the organization's.
- `claude-md`: leave the engine's walk alone.

It walks ancestors with `$.fs.ancestors({ names })` and rewrites `prompt.context`'s `instructionFiles` so the engine frames them exactly like CLAUDE.md. On a `Read` (`tool.call {tool:'Read'}`), it attaches nested AGENTS.md files the way the engine attaches nested CLAUDE.md files. It also handles forked agents. It writes telemetry rows and `$.ui.log` debug lines. It is a good example of a mod that changes the model's input with no UI at all.
**Events:** `session.start`, `prompt.context {instructionFiles:{kind:DROPPED_KINDS}}` (managed-only), `prompt.context` (AGENTS.md modes), `agent.spawn {fork:true}`, `tool.call {tool:'Read'}`.
**$ APIs (validator):** `$.env.get`, `$.fs.ancestors`, `$.session.cwd`, `$.session.root`, `$.telemetry.log/mark`, `$.ui.log`. Env reads: `CLAUDE_CODE_DISABLE_ATTACHMENTS`, `CLAUDE_CODE_SIMPLE`, `HOME`, `USERPROFILE`.
**ui.render components:** none.
**Key lines:** register.ts 75–85 (BEFORE: `next({ ...e, instructionFiles: e.instructionFiles?.filter(...) })`), 99–163 (`prompt.context` walk and inject), 180 `tool.call {tool:'Read'}` (AFTER: `const result = await next(e)`, then augment).

### B3. sec-default — `upstream/claude-code/mods/sec-default/`

**Lines:** 668 source in 52 files (entry `hooks/register.ts`: 115). Tests: 1,956 lines in 61 files.
**What it does:** The organizational security default. It is seated outermost and adds no policy of its own. It keeps the organization's classic hooks, prompt content, managed settings, tool policy and deny rules out of reach of user-installed plugins:
- `next.to(e, 'append')` continues past the user tier on `classic.*`, `prompt.*`, `skill.prompt`, `attribution.text` and `settings.read`.
- `pastUsers` is applied on `tool.describe`, `command.describe`, `agent.offer` and `agent.spawn`.
- A user-tier `tool.register` is refused under an MCP allowlist.
- `tool.list` restores the organization's managed tools.
- `tool.check` re-imposes a settings deny rule that a user-tier mod loosened, using `next.trace`.
- `plugin.register {tier:'user'}` refuses user hooks modules when the managed option `allowManagedModsOnly` is set.

This is the canonical example of tier and provenance reasoning (`next.origin.tier`).
**Events:** `classic.*` (glob), `prompt.section`, `prompt.context`, `prompt.compose`, `skill.prompt`, `attribution.text`, `settings.read`, `tool.describe`, `command.describe`, `agent.offer`, `agent.spawn`, `tool.register`, `tool.list`, `tool.check`, `plugin.register {tier:'user'}`.
**$ APIs (validator):** `$.settings.read`, `$.ui.log`, and `next.to:append` (not a `$` call, but listed by the validator).
**ui.render components:** none.
**Key lines:** register.ts 24 (`on('classic.*', ($, e, next) => next.to(e, 'append'))`), 39–55 (`tool.register` refusal by `next.origin.tier`), 66–80 (`tool.check` re-check after `await next(e)`).

### B4. telemetry — `upstream/claude-code/mods/telemetry/`

**Lines:** 3,061 source in 209 files (entry `hooks/register.ts`: 369). Tests: 1,952 lines in 62 files.
**What it does:** Implements `$.telemetry.log` and `$.telemetry.mark` for built-in plugins as first-party analytics rows (`tengu_plugin_<event>` and `tengu_feature_<kind>`), sent in batches. One POST to the ingest goes out a few seconds after the first row, immediately at 100 rows, and at `session.end`, authorized with `$.session.authorize()`. A batch that fails is retried once. A gate on `telemetry.*` refuses calls from installed or admin-listed plugins and lets rows addressed `to: 'collector'` pass beneath untouched. Its `engine.create` hook **adds the `telemetry` noun to `$`** on engines that lack one, building the sender over `beneath` (the `$` that `next(e)` returns at `engine.create`). It gathers env/platform data (a large list of env reads) once per session. It sends nothing when analytics are off. It also ships `types/index.d.ts` declaring `$.telemetry`.
**Events:** `telemetry.*` (glob gate), `telemetry.log`, `telemetry.mark`, `session.start`, `session.end`, `engine.create`.
**$ APIs (validator, via `beneath.*`):** `$.clock.after/sleep`, `$.env.get`, `$.fs.exists/list/read`, `$.http.fetch`, `$.process.run`, `$.session.authorize/cwd/id/model/repo/surfaces/version`, `$.settings.read`, `$.ui.log`.
**ui.render components:** none.
**Key lines:** register.ts 27 (`on('telemetry.*', … Gate.served(e, next))`), 53–58 (`engine.create`: `const beneath = await next(e)`, then wrap nouns), 358 (`fetch: (url, init) => beneath.http.fetch(url, init)`).

### `claude plugin validate` (2.1.288) on the built-ins

```
diff        ✔ Validation passed (exit 0)
  hooks: session.start, ui.render{component=PromptHint}, ui.render{component=Pane}, command.run{command=diff},
         ui.close{id=?}, ui.focus{plugin=?}, ui.scroll{requestId=?}, command.run{command=clear|resume},
         tool.call{tool=?|?}, prompt.submit
  calls: $.clock.after, $.clock.every, $.clock.now, $.command.register, $.env.get, $.fs.list, $.fs.read,
         $.fs.stat, $.process.run, $.session.id, $.session.messages, $.session.usage, $.settings.read,
         $.store.get, $.store.set, $.telemetry.log, $.telemetry.mark, $.ui.close, $.ui.invalidate, $.ui.log,
         $.ui.open, $.ui.resolve, $.ui.status
  env reads: CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING

agents-md   ✔ Validation passed (exit 0)
  hooks: session.start, prompt.context{instructionFiles has {kind=?}}, prompt.context, agent.spawn{fork=true}, tool.call{tool=Read}
  calls: $.env.get (via attachesOnRead, homeOf), $.fs.ancestors, $.session.cwd, $.session.root, $.telemetry.log,
         $.telemetry.mark, $.ui.log
  env reads: CLAUDE_CODE_DISABLE_ATTACHMENTS, CLAUDE_CODE_SIMPLE, HOME, USERPROFILE

sec-default ✔ Validation passed (exit 0)
  hooks: classic.*, prompt.section, prompt.context, prompt.compose, skill.prompt, attribution.text, settings.read,
         tool.describe, command.describe, agent.offer, agent.spawn, tool.register, tool.list, tool.check,
         plugin.register{tier=user}
  calls: $.settings.read, $.ui.log, next.to:append

telemetry   ✘ Validation failed (exit 1)
  types ./types/index.d.ts declares on $: $.telemetry
  ✘ modules../register.ts: its hooks stand on the telemetry stream "anthropic" (a matcher names it, or a
    telemetry hook names no "to" and so stands on every stream), which is for the plugins built into the CLI;
    name the collector on each telemetry hook: on("telemetry.log", { to: "collector" }, hook)
  hooks: telemetry.*, telemetry.log, telemetry.mark, session.start, session.end, engine.create
  calls: $.clock.after, $.clock.sleep, $.env.get, $.fs.exists, $.fs.list, $.fs.read, $.http.fetch,
         $.process.run, $.session.authorize, $.session.cwd, $.session.id, $.session.model, $.session.repo,
         $.session.surfaces, $.session.version, $.settings.read, $.ui.log
  env reads: (very long list: CI/cloud/terminal/IDE detection vars) …
  hooks telemetry for: anthropic, collector
```

The telemetry failure is expected. It is a built-in that claims the reserved `anthropic` stream, and the validator treats any folder you point it at as a non-built-in plugin. The awesome-list scanner, which runs the same 2.1.288 validator, records the same failure for telemetry and "passed" for the other three.

`claude plugin test` was **not** run. It was optional, and this pass was kept strictly to `validate`.

---

## C. Community samples (karanb192/claude-code-mods)

| Path | What | Lines | Events | $ APIs | UI | validate |
|---|---|---|---|---|---|---|
| `plugins/fable-pin/hooks/register.ts` | Rewrites `agent.spawn` so every non-fork subagent runs on the `fable` model. `/fable-pin on\|off\|status` is persisted in `$.store`. | 36 (+63 test) | `session.start`, `command.run {command:'fable-pin'}`, `agent.spawn` | `$.command.register`, `$.store.get`, `$.store.set` | none | ✔ passed |
| `plugins/image-peek/hooks/register.ts` (+`selection.ts`, `clipboard.js`) | Shows images pasted or attached in the prompt as a band or pane preview. It reads the macOS clipboard through `osascript`/JXA; the `$.NS…` strings are ObjC-bridge code inside `clipboard.js`, not mod `$`. Session-scoped state goes in declared `$.state` (`image-peek.session`). | 334 (+259 test) | `session.start`, `prompt.edit`, `prompt.fill`, `command.run {command:'image-peek'}`, `session.end`, `session.compact`, `ui.render {AbovePrompt}`, `ui.render {Pane, requestId:'image-peek'}`, `ui.close {id:'image-peek'}` | `$.clock.every`, `$.command.register`, `$.env.get`, `$.process.run`, `$.prompt.read`, `$.session.id`, `$.state.get/set`, `$.ui.close/invalidate/log/open/panes/resolve` | AbovePrompt + Pane; `Box`, `Text`, `Image` | ✔ passed |
| `plugins/mod-builder/skills/mod-builder/` | A **skill**, not a mod. SKILL.md plus `references/` (events.md, nouns.md, gotchas.md, threat-model.md, templates.md, testing.md, …) and scripts (`footprint.mjs`, `list-mods.mjs`). It teaches "plan → write → read validator back → threat model". | n/a | n/a | n/a | n/a | not run (skill) |

fable-pin's `register.ts` lines 11–12 and 26 are the shortest DURABLE example in any sample: `$.store.get(KEY)` at `session.start` and `$.store.set(KEY, enabled)` from the command. Line 34, `return next({ ...e, model: TARGET })`, is the shortest BEFORE/rewrite example.

**Caution:** mod-builder's `references/gotchas.md` line 7 says nothing loads unless `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` is set. The playground README and the awesome README both say mods load by default from 2.1.287. That string does not appear in the 2.1.287 `.d.ts`. Treat it as stale guidance from before release.

---

## D. Awesome list (karanb192/awesome-claude-code-mods): curated mods by category with declared capabilities

Source: the README's curated sections, each entry matched by URL or repo+path to the scanner's `data/mods.json`. The scanner runs `claude plugin validate` (2.1.288) and maps each mod's `$` calls to "reach" labels. The columns map those labels to:
- **read**: reads files, env vars, the transcript or settings.
- **write**: writes files, writes the prompt box, changes config, sets env vars.
- **run**: runs processes, drives Claude, or `$.process.spawn`.
- **network**: network, or MCP servers.
- **Persists state**: `$.store`/`$.state` writes. It is kept separate so it does not inflate "write".

The scanner's own levels are: 0 draws and remembers, 1 reads, 2 writes or runs, 3 network.

#### Summary by category (curated README entries matched to the scanner)

| Category | Mods matched | read | write | run | network | persists state | scanner reach levels |
|---|---|---|---|---|---|---|---|
| Dashboards and usage | 17 | 10 | 5 | 5 | 0 | 12 | L2 writes or runs: 7, L0 draws and remembers: 4, L1 reads: 6 |
| While you wait | 11 | 4 | 3 | 2 | 2 | 9 | L0 draws and remembers: 6, L3 network: 2, L1 reads: 1, L2 writes or runs: 2 |
| Git, pull requests and CI | 5 | 4 | 0 | 5 | 1 | 0 | L2 writes or runs: 4, L3 network: 1 |
| Safety and privacy | 8 | 5 | 1 | 4 | 1 | 3 | L0 draws and remembers: 1, L3 network: 1, L1 reads: 3, L2 writes or runs: 3 |
| Memory and context | 5 | 2 | 1 | 5 | 1 | 1 | L3 network: 1, L2 writes or runs: 4 |
| Rendering | 2 | 1 | 1 | 2 | 1 | 1 | L3 network: 1, L2 writes or runs: 1 |
| Agents and workflows | 7 | 6 | 3 | 4 | 1 | 2 | L1 reads: 1, L2 writes or runs: 5, L3 network: 1 |
| Building mods | 0 | 0 | 0 | 0 | 0 | 0 |  |

Whole scan (1018 mods of kind mod/builtin, scanned 2026-10-03 with Claude Code 2.1.288): 0 draws and remembers: 112, 1 reads: 220, 2 writes or runs: 518, 3 network: 168
Mods declaring each capability class: read: 571, run: 591, persists state: 422, network: 168, write: 241

### Dashboards and usage

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [cctop](https://github.com/tomstagl/cctop) | 2 writes or runs | reads env vars, reads files | writes files, writes the prompt box | runs processes | - | yes | passed |
| [token-ledger](https://github.com/Arunjay4213/claude-mods/tree/main/plugins/token-ledger) | 0 draws and remembers | - | - | - | - | yes | passed |
| [context-lens](https://github.com/Arunjay4213/claude-mods/tree/main/plugins/context-lens) | 0 draws and remembers | - | - | - | - | - | passed |
| [quota-meter](https://github.com/Arunjay4213/claude-mods/tree/main/plugins/quota-meter) | 0 draws and remembers | - | - | - | - | yes | passed |
| [agent-flow](https://github.com/Charlie0113-T/claude-agent-flow) | 0 draws and remembers | - | - | - | - | yes | passed |
| [effort-cycle](https://github.com/Anerco/effort-cycle-mod) | 1 reads | reads settings | - | - | - | - | passed |
| [burn-meter](https://github.com/OneWave-AI/claude-code-mods/tree/main/burn-meter) | 1 reads | - | - | - | - | yes | passed |
| [session-wrapped](https://github.com/OneWave-AI/claude-code-mods/tree/main/session-wrapped) | 2 writes or runs | reads env vars | - | runs processes | - | - | passed |
| [context-view](https://github.com/kongyo2/context-view) | 1 reads | reads env vars | - | - | - | yes | passed |
| [wavy-usage](https://github.com/BatuhanCakmakk/wavy-usage) | 1 reads | reads env vars | - | - | - | yes | failed |
| [token-weather-usage](https://github.com/augiefra/claude-mods/tree/main/plugins/token-weather-usage) | 1 reads | reads env vars | - | - | - | yes | passed |
| [flightdeck](https://github.com/scasella/claude-flightdeck) | 1 reads | - | - | - | - | - | passed |
| [usage-band](https://github.com/pawandeepdhall/claude-mods/tree/main/plugins/usage-band) | 2 writes or runs | - | - | drives Claude, runs processes | - | - | passed |
| [hud](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/hud) | 2 writes or runs | reads files, reads settings | changes config, writes files | drives Claude, runs processes | - | yes | passed |
| [todo-bar](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/todo-bar) | 2 writes or runs | reads env vars, reads settings | changes config | - | - | yes | passed |
| [receipt](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/receipt) | 2 writes or runs | reads env vars, reads settings | changes config | - | - | yes | passed |
| [ts-band](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/ts-band) | 2 writes or runs | reads env vars, reads settings | changes config | runs processes | - | yes | passed |

### While you wait

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [Mindful-Claude](https://github.com/halluton/Mindful-Claude) | 0 draws and remembers | - | - | - | - | yes | warnings |
| [cc-arcade](https://github.com/sezaakgun/cc-arcade) | 0 draws and remembers | - | - | - | - | yes | passed |
| [claude-games](https://github.com/mohi-devhub/claude-games) | 0 draws and remembers | - | - | - | - | yes | failed |
| [clawd-spinner](https://github.com/saiharsha03/clawd-spinner) | 0 draws and remembers | - | - | - | - | - | passed |
| [cc-pokedex](https://github.com/deonmenezes/claude-mods-pokedex) | 0 draws and remembers | - | - | - | - | yes | passed |
| [nibbl](https://github.com/nuromirzak/nibbl) | 3 network | reads env vars, reads files | - | runs processes | network | yes | passed |
| [time](https://github.com/diegorv/claude-functions-hook/tree/main/plugins/time) | 0 draws and remembers | - | - | - | - | - | passed |
| [boss-fight](https://github.com/OneWave-AI/claude-code-mods/tree/main/boss-fight) | 1 reads | - | - | - | - | yes | passed |
| [intermission](https://github.com/jarrodwatts/intermission) | 2 writes or runs | reads files | writes files | $.process.spawn, runs processes | - | yes | passed |
| [spinner](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/spinner) | 2 writes or runs | reads env vars, reads settings | changes config | - | - | yes | passed |
| [hitokoto](https://github.com/hoobnn/hoobnn-agent-mods/tree/main/claude-code/hitokoto) | 3 network | reads env vars, reads settings | changes config | - | network | yes | passed |

### Git, pull requests and CI

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [cc-pr-tracker](https://github.com/sezaakgun/cc-pr-tracker) | 2 writes or runs | reads env vars, reads files | - | runs processes | - | - | passed |
| [gh-ci-status](https://github.com/diegorv/claude-functions-hook/tree/main/plugins/gh-ci-status) | 2 writes or runs | - | - | runs processes | - | - | passed |
| [vercel-deploy-status](https://github.com/ray-amjad/awesome-claude-code-function-hooks/tree/main/plugins/vercel-deploy-status) | 2 writes or runs | reads files | - | runs processes | - | - | passed |
| [pr-bridge-watch](https://github.com/ippoan/gh-actions-live/tree/main/mods/pr-bridge-watch) | 3 network | reads env vars | - | drives Claude, runs processes | network | - | passed |
| [deploy-verify](https://github.com/yash-gadodia/claude-mods/tree/main/deploy-verify) | 2 writes or runs | reads env vars, reads files | - | drives Claude, runs processes | - | - | passed |

### Safety and privacy

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [secret-redactor](https://github.com/ray-amjad/awesome-claude-code-function-hooks/tree/main/plugins/secret-redactor) | 0 draws and remembers | - | - | - | - | - | passed |
| [honmoon-redact](https://github.com/pleaseai/honmoon/tree/main/packages/claude-plugin) | 3 network | - | - | runs processes | network | - | passed |
| [kb-settings-guard](https://github.com/ray-manaloto/knowledge-base/tree/main/.claude/mods/kb-settings-guard) | 1 reads | reads files | - | - | - | - | passed |
| [claude-doctor](https://github.com/ray-manaloto/dotfiles/tree/main/.claude/skills/claude-doctor) | link to a repo of 4 mods, no single match | | | | | | |
| [plugin-health](https://github.com/ray-manaloto/dotfiles/tree/main/.claude/skills/plugin-health) | 2 writes or runs | reads env vars | - | runs processes | - | - | passed |
| [launch-codes](https://github.com/OneWave-AI/claude-code-mods/tree/main/launch-codes) | 1 reads | - | - | - | - | - | passed |
| [scope-guard](https://github.com/yash-gadodia/claude-mods/tree/main/scope-guard) | 2 writes or runs | reads env vars, reads the transcript | - | drives Claude | - | yes | passed |
| [merge-gate](https://github.com/yash-gadodia/claude-mods/tree/main/merge-gate) | 2 writes or runs | reads env vars, reads the transcript | - | runs processes | - | yes | passed |
| [receipt](https://github.com/yash-gadodia/claude-mods/tree/main/receipt) | 1 reads | reads env vars | writes the prompt box | - | - | yes | passed |

### Memory and context

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [lcm](https://github.com/lossless-claude/lcm) | 3 network | reads env vars | writes files | drives Claude, runs processes | network | - | warnings |
| [kindex-modern](https://github.com/wandercom/kindex/tree/main/src/kindex/claude_modern) | 2 writes or runs | - | - | drives Claude, runs processes | - | - | passed |
| [segmem](https://github.com/mahuebel/segmem) | 2 writes or runs | - | - | drives Claude, runs processes | - | - | passed |
| [commonplace](https://github.com/noopz/commonplace) | 2 writes or runs | - | - | drives Claude, runs processes | - | yes | warnings |
| [aside](https://github.com/JayDoubleu/aside) | 2 writes or runs | reads the transcript | - | drives Claude | - | - | passed |

### Rendering

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [terminal-browser](https://github.com/zenbu-labs/terminal-browser/tree/main/claude-code-plugin) | 3 network | reads files | writes the prompt box | drives Claude, runs processes | network | - | passed |
| [claude-mermaid](https://github.com/galElmalah/claude-mermaid) | not a scanned mod (doc, skill or link) | | | | | | |
| [skins](https://github.com/hellosverre/claude-skins) | 2 writes or runs | - | - | drives Claude | - | yes | passed |

### Agents and workflows

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [autodev-core](https://github.com/djnsty23/claude-auto-dev/tree/main/plugins/autodev-core) | 1 reads | reads files | - | - | - | - | passed |
| [catalyst-probes](https://github.com/TransmuteLabs/Catalyst/tree/main/plugins/catalyst-probes) | 2 writes or runs | reads env vars, reads files, reads the transcript | writes files | drives Claude, runs processes | - | yes | passed |
| [autotel](https://github.com/jagreehal/autotel/tree/main/packages/autotel-claude-code) | 3 network | reads env vars | - | - | network | - | passed |
| [homie-persona-cognition](https://github.com/TheSmokeDev/taskchad-os/tree/main/.claude/plugins/persona-cognition) | 2 writes or runs | reads env vars | - | runs processes | - | - | warnings |
| [agent-race](https://github.com/OneWave-AI/claude-code-mods/tree/main/agent-race) | 2 writes or runs | reads env vars, reads files | writes files | - | - | - | passed |
| [AFKSwitch](https://github.com/augbastos/afkswitch) | 2 writes or runs | reads env vars, reads files | - | drives Claude | - | yes | passed |
| [next-steps](https://github.com/pawandeepdhall/claude-mods/tree/main/plugins/next-steps) | 2 writes or runs | - | writes files | drives Claude | - | - | passed |

### Building mods

| Mod | Reach (scanner level) | Read | Write | Run | Network | Persists state | Validate |
|---|---|---|---|---|---|---|---|
| [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/) | not a scanned mod (doc, skill or link) | | | | | | |
| [Claude Code mods announcement](https://claude.com/blog/claude-code-mods) | not a scanned mod (doc, skill or link) | | | | | | |
| [Function Hooks: the issue](https://github.com/anthropics/claude-code/issues/91870) | link to a repo of 4 mods, no single match | | | | | | |
| [Anthropic's built-in mods](https://github.com/anthropics/claude-code/tree/main/mods) | link to a repo of 4 mods, no single match | | | | | | |
| [claude-mods-skill](https://github.com/BeLazy167/claude-mods-skill) | not a scanned mod (doc, skill or link) | | | | | | |
| [awesome-claude-code-function-hooks](https://github.com/ray-amjad/awesome-claude-code-function-hooks) | link to a repo of 2 mods, no single match | | | | | | |

Notes: "Building mods" entries are docs, a skill, or whole repos, not single mods. claude-mermaid and claude-mods-skill have no scanner match. The scanner also flags 'other:' $ calls outside the core API, such as `$.sidebar.*`, `$.gemini.*`, `$.flow.*`, `$.runtime.*` and `$.fs.remove`. These are plugin-declared nouns or mistakes, and none of them appear in the official samples.

