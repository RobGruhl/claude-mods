# Claude Code mods: architecture and lifecycle notes

Research date 2026-10-03. Installed build 2.1.288. Mods shipped in v2.1.287 on 1 Oct 2026.
These notes are laid out so the infographics can be drawn from them: one section per lifecycle stage, then the cross-cutting middleware chain and failure model.

**Citation keys.** Each one names a file in `research/docs/` unless it says otherwise.
`OV` mods-overview · `REF` mods-reference · `CR` mods-create · `UI` mods-interface · `EV` mods-events · `API` mods-api · `ADM` mods-admin · `TS` mods-troubleshoot · `TEST` mods-test · `B1` blog-claude-code-mods · `B2` blog-getting-started-with-mods · `REL` github-release-v2.1.287 · `WN` whats-new · `HG` hooks-guide · `BREF` = `research/bundled-2.1.287/reference.md` (the long form of the bundled plugin-authoring skill) · `DTS` = `research/bundled-2.1.287/types/claude-code.d.ts`.

**Markers.** **[D]** means the docs say it. **[I]** means I inferred it. **[!]** marks a discrepancy.

---

## 0. One-sentence model

A mod is a plugin whose `hooks/hooks.json` names a JS/TS "hooks module". The module exports `register(on, options)`, and each `on(event, matcher?, hook)` adds a `($, e, next)` middleware to a per-event chain. The chain is ordered by tier and ends in Claude Code's own behaviour ("core"/"engine"). The module reaches the outside world only through the `$` mods API. **[D]** OV, REF, EV

---

## 1. Packaging and discovery

### Folder layout **[D]** REF "Files", CR

```
my-mod/
├── .claude-plugin/plugin.json      required; standard manifest, no mod-specific required fields
│   └── types/                      WRITTEN BY CLAUDE CODE on every load/reload (claude-code/, claude-code-tools/, claude-code-mcp/, tsconfig.json)
├── hooks/hooks.json                required; { "modules": ["./register.js"] } (exactly one path); may also hold classic `hooks`
├── hooks/register.{js,mjs,cjs,jsx,ts,mts,cts,tsx}   ES module exporting register(on, options)
├── types/index.d.ts                needed if the mod uses $.state or adds a $ namespace; named by "types" in plugin.json
└── **/*.test.ts(x)                 run by `claude plugin test`
```

- What makes a plugin a mod is the `modules` key in `hooks.json`. Without it, `validate` passes but prints no `hooks:` line. **[D]** CR, TS
- No Node, bundler or build step is needed: `.ts` loads directly. Imports must be relative files inside the plugin. The only bare import allowed is `claude-code`, for types and the `atom`/`read`/`update`/`derive`/`memberOf` helpers. Dynamic `import()` is refused. **[D]** CR
- One plugin can carry a mod alongside skills, agents, MCP servers and classic hooks. **[D]** OV "Compare…"

### Ways a mod gets loaded **[D]**

| Route | Notes | Source |
|---|---|---|
| Marketplace install (`/plugin install x@mkt`, `claude plugin install`) | Runs the cached copy for its version. Edits don't reach it, so develop with `--plugin-dir`. | OV, CR, TS |
| `claude --plugin-dir <dir>` (repeatable; also `.zip`) | Loads for one session. The folder is watched and hot-reloads. Shows as `name@inline`. | CR, REF, TS |
| `CLAUDE_CODE_PLUGIN_DIRS` (env, or `env` in `~/.claude/settings.json`, never project settings) | For hosts that can't take a flag (Desktop, SDK). `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` turns on watching for long-running headless hosts. | REF, BREF |
| Claude writes it (`plugin-authoring` skill) | Goes to `~/.claude/dev-mods/<session-id>/<mod>/`. Loads only after the user picks "Enable for this session", and only in that session. Deleted after `cleanupPeriodDays`. | CR |
| Built-in mods (`cc-plugin-*@builtin`) | `agents-md`, `diff`, `plugin-authoring` (a skill only), `sec-default`, `telemetry`, `you-should-know` (off by default). | OV, REL |
| Org mods | Count as "yours" only when they are in managed `enabledPlugins`, live in a **directory** marketplace at an absolute path, and are listed by relative path, so they load in place. A GitHub/git/URL/npm source counts as a user's mod, even when managed settings enable it. | ADM |

### On/off switches (draw these as a stack of gates) **[D]** OV, REF, ADM, TS

1. **Remote kill switch.** Anthropic can turn installed mods off remotely. The messages are `hooks modules are turned off in this process` (from `claude plugin test`) and `…turned off for installed plugins in this process` (in the debug log). No local setting overrides it. **[D]** TS. OV hints at it too: `plugin-authoring` is on "unless Anthropic has turned installed mods off remotely".
2. **Workspace trust.** No mod loads until the trust prompt has been accepted. **[D]** ADM, TS
3. **`--safe-mode` / `--bare`.** These turn off installed mods (`--bare` keeps managed ones). Built-in mods are not affected. **[D]** OV, TS
4. **`disableAllHooks`.** In user settings it stops the user's mods and hooks; managed ones keep running. In managed settings it stops every installed mod, org mods included. **[D]** REF, ADM
5. **`allowManagedHooksOnly`** (managed). Only org and built-in mods load, and users' settings hooks are blocked too. **[D]** ADM
6. **`allowManagedModsOnly`.** This is an *option on the sec-default guard*, set at `pluginConfigs["cc-plugin-sec-default@builtin"].options`, and it is honoured only in managed settings. Users' settings hooks keep working. **[D]** ADM
7. **`disableSideloadFlags`** (managed). Rejects `--plugin-dir`/`--plugin-url` and stops Claude-written mods from loading. **[D]** ADM
8. **Marketplace allowlists** such as `strictKnownMarketplaces` decide whether a mod can be installed in the first place. **[D]** ADM
9. **Per-plugin disable** in `/plugin`. **[D]** OV
- `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` was the early-access flag. 2.1.287+ ignores it, so setting it to `0` does **not** turn mods off. **[D]** OV, ADM

### Trust and sandbox stance **[D]** OV, ADM, B1

- **Mods aren't sandboxed.** They run "with your permissions": they can reach files, processes, the network, env/secrets, every prompt and every tool call. They can approve tool calls and spend model usage. A process a mod starts runs outside the Bash sandbox. **[D]** OV
- The *module* runs in an isolated JS environment with no DOM, no Node, no `setTimeout`, and no file or network globals. Web APIs such as `URL`, `TextEncoder`, `AbortController` and `crypto.subtle` exist. All I/O goes through `$`. **[D]** API, B2, BREF
- **[!] Sandbox discrepancy.** B2 says "The module runs in a sandbox of its own", while OV, ADM and B1 say "Mods aren't sandboxed". The two fit together like this **[I]**: the runtime is *capability-isolated* (no ambient authority, so every effect is a `$` call that static analysis can list), but `$` hands out the user's full authority. That makes it an audit boundary, not a security boundary.
- Static analysis is load-bearing. `claude plugin validate` prints `hooks:`, `calls:`, `env reads/writes:` and `state reads/writes:`. Claude Code **refuses to load** a module whose use of `$` it can't read: aliasing `$.ui`, destructuring `$`, computed event names, or passing `$` to functions that are not top-level. **[D]** CR, ADM. This same list is what `plugin.register` hooks receive as `e.uses`. **[D]** REF
- Mods cannot touch the permission prompt, which is not a render site. **[D]** OV, UI, ADM

### Relation to classic hooks, skills, agents, MCP **[D]** OV, HG, EV

| | Mod | Settings ("classic") hook | Skill | MCP |
|---|---|---|---|---|
| Runs | In-process functions (a worker thread for installed mods, per TS) | Shell/HTTP/prompt/agent/mcp_tool per event; JSON over stdin/stdout | Markdown Claude reads | External server |
| Lifetime | Loaded once; keeps state | Spawned per event | n/a | Separate process |
| Multiple handlers | Sequential **ordered** chain | Run **in parallel**; most restrictive decision wins; `updatedInput` is last-writer-wins and non-deterministic (HG) | | |
| Can draw UI / register commands and tools | Yes | No | No | Tools only |

- Classic events are exposed to mods as `classic.<Event>`, such as `classic.Stop` or `classic.SessionStart`, with `e` = the stdin JSON. **[D]** REF, EV
- A mod can register a tool (`$.tool.register`, seen by Claude as `mcp__<plugin>__<name>` and served by its own `tool.call` hook) and agents (`$.agent.register`, `<plugin>:<name>`). It can call MCP tools through `$.mcp.call`. **[D]** API, BREF
- Nothing about classic hooks is deprecated. **[D]** ADM

---

## 2. Load

Sequence to draw: discover → admit → build `$` → `register` → `session.start` → first prompt.

1. **Admission.** For each hooks module about to load, `plugin.register` fires with `e.tier` and `e.uses`. A prepended policy mod can return `{ refuse }`. **[D]** REF, ADM
2. **Build `$`.** `engine.create` fires for the mod, and a hook can add or withhold a namespace. The built-in `telemetry` mod adds methods this way and ships their types. A namespace a mod adds is typed through `declare module 'claude-code' { interface EngineInterface {…} }`, and dependents get that contract in `.claude-plugin/types/<plugin>/`. **[D]** REF, OV, BREF
3. **`register(on, options)`** runs once per load. `options` = the `userConfig` values from the manifest with defaults filled in, read from `pluginConfigs` (keyed `name@marketplace` or `name@inline`). An invalid option means the module doesn't load (`options do not fit plugin.json userConfig`). **[D]** REF, TS. Changing a non-secret option in `/config` reloads the module with the new options. **[D]** BREF
4. **`ui.resolve`** fires once per app × render site × mod, producing the element tables. **[D]** REF
5. **`session.start`** fires for each loaded mod before the first prompt, and Claude Code **awaits** it, so commands and tools registered there exist from turn 1. Register each event only once without a matcher, or the load fails. **[D]** API, EV, REF
- Debug-log signature: `hooks module first-mod@inline loaded (worker, environment 2, tier user); events: …` **[D]** TS

### Hot reload **[D]** CR, TS, BREF

- Triggers: saving a watched folder (`--plugin-dir`, `CLAUDE_CODE_PLUGIN_DIRS`, the dev-mods folder once enabled), `/reload-plugins`, or a `userConfig` change.
- Debounce: when Claude itself edits the mod during a turn, the reload happens once at turn end, or sooner if a tool or command the plugin registered is about to run. External saves reload once the folder goes quiet (about 0.25 s). **[D]** BREF
- A reload calls `register` again in a **fresh environment**, and `session.start` fires again.
- **Survives a reload:** `$.state` and `$.store`.
- **Lost on a reload:** module-level variables and timers (`$.clock.every/after`).
- A reload that fails keeps the previous version loaded (`reload failed, the previous version stays loaded`). **[D]** TS
- Types are rewritten into `.claude-plugin/types/` on each load. **[D]** CR

---

## 3. BEFORE a turn

| Event | What it can do | Src |
|---|---|---|
| `session.start` | Register commands/tools, start timers, load from `$.store`. Its result `{cwd}` can't change the session. `e.surface` is null for `-p`/SDK. | API, DTS |
| `prompt.fill` / `prompt.suggest` / `prompt.edit` | Change draft and suggestion text in the prompt box | REF |
| `prompt.submit` | Rewrite `text` (the transcript shows the new text), append Claude-only `context`, or `{ drop }` | EV |
| `command.run` / `command.describe` | Answer a slash command with `{text}` (Claude reads it) or `{}`. `immediate: true` lets it run mid-turn. Built-in names are refused. | API |
| `prompt.compose` | Returns the whole system prompt as `{ sections: [{id,text,scope}] }`. `scope` is `shared` (before the cache boundary, cacheable across orgs) or `session`. Engine section ids include `intro`, `system`, `doing_tasks`, `actions`, `tools`, `tone`, or `lean_body`/`bare`. Plugin ids are `<plugin>:<name>`. | REF, DTS |
| `prompt.section` | Per named section: `{text}` or `{text:null}` to drop it | REF |
| `prompt.context` | Context blocks for the first message, once per conversation | REF |
| `prompt.attachment` / `skill.prompt` / `attribution.text` | Reminders, skill expansions, commit/PR attribution | REF |
| `tool.describe` / `agent.offer` / `config.describe` | Rewrite tool descriptions or defer them behind tool search; withhold subagent types; hide or relabel config rows | REF |
| `turn.start` | Observe the start (`e.turnId`) | EV |

- Text that changes between requests breaks the prompt cache. **[D]** EV
- The sec-default guard stops a *user's* mod from changing the system prompt and managed instructions where the guard loads. **[D]** ADM

---

## 4. DURING a turn

### Tool path (draw this as a vertical pipeline) **[D]** EV, ADM

```
model emits tool_use
 → managed PreToolUse hooks           (block = final; no mod sees it)
 → mod chain: tool.call               (prepend → user → append → builtin)
     each hook can: observe | rewrite args → next({...e}) | deny {deny} | answer {result} | retry (call next twice) | post-process (await next, edit result)
 → [core] non-managed PreToolUse hooks (settings + plugins' hooks.json)
 → tool.check chain                   (next(e) = rules + mode + hooks decision; return {decision: allow|ask|deny})
 → permission prompt (not mod-drawable) → tool runs
 → result flows back up through tool.call hooks
```
- If a mod rewrites a call, the managed PreToolUse hooks run again on the rewritten call. **[D]** ADM
- Where the guard loads, a user mod can't lift a `deny` rule unless `allowModsToOverrideDenyRules` is set. It *can* override `ask` rules and non-managed PreToolUse blocks, and in auto mode an approved call skips the classifier. **[D]** ADM, HG
- In auto mode, changing input after the classifier reviewed it gets the call denied with "a hook changed this call's input…". **[D]** TS
- A hook can hold a call with `$.ui.ask` (or the B2 "Blast Radius" sleep-loop). Waiting inside `$` calls doesn't count against the 10 s budget. **[D]** EV, B2

### Model calls and streaming **[D]** EV, API, BREF

- `turn.step`: one per model request, with `e.agentId` set for subagents. It is an **async generator**: `yield* next(e)` streams chunks through, and the hook can change `model`/`effort`, rewrite chunks, or answer without calling the model. `process.spawn` is the other streaming event.
- `$.model.complete`: one history-free completion on the user's plan/key. It always resolves; check `isAnswered`. `$.model.fork`: one question over the current transcript, served from the prompt cache. `$.model.classify` also exists.
- `agent.spawn`: rewrite prompt/type/model/background/cwd or `{deny}`. Identity fields are pinned. The subagent's answer arrives as its own `turn.complete` carrying its `agentId`. **[D]** REF, DTS

### Interface **[D]** UI, REF

- `ui.render` fires per render site. Sites: `Pane`, `AbovePrompt` (the band), `UserMessage`, `AssistantMessage`, `ToolUse`/`ToolResult`/`ToolGroup`, `CommandOutput`, `AskUserQuestion`, `Spinner`, `ToolProgress`*, `TurnDuration`*, `InfoNotice`*, `SessionMode`, `PromptHint` (* = terminal only).
- Three moves: change props with `next({...e, props})`, replace by returning a tree, or wrap: `await next(e)` returns an `{type:'engine', ref}` that can go inside your Box.
- Imperative surfaces: `$.ui.status` (line under the prompt), `$.ui.toast` (4 s, top right), `$.ui.log` (dim transcript line Claude doesn't read, or `{to:'debug'}`), `$.ui.notice`, `$.ui.ask`, `$.ui.open/close` (panes), `$.ui.blit` (repaint a Raster/Image without a render pass), `$.ui.copy`, `$.ui.selection` (added in 2.1.288, **[D]** REL).
- Elements come from `$.ui.resolve(e)` per surface: Box, Text, Button, Link, Code, Markdown, Input, Select, Client (a second file with no `$` that posts `ui.message`), Svg (desktop only), Raster and Image (terminal only).
- Controls raise `ui.press`/`ui.input`/`ui.select`. Another mod's hook sees these *before* the owner's callback. Focus and scroll are events too (`ui.focus`, `ui.scroll`, `ui.close`).
- Redraw: on prop or width change, `$.ui.invalidate('ui.render')` (throttled to 10/s, or 30/s for visible terminal sites), or automatically on a `$.state` write.
- A pane opened without the user asking appears only at ≥144 columns (110 once the user has opened it before). `isPlaced:false` otherwise.

### Surfaces **[D]** OV, REF · **[!]** DTS, BREF

| Where | Hooks run | Drawings show |
|---|---|---|
| Terminal CLI (incl. IDE terminals, JetBrains) | ✓ | ✓ |
| Desktop Code tab | ✓ | ✓ (no Raster/Image or terminal-only sites) |
| Desktop WSL session | ✗ | ✗ |
| VS Code extension chat panel | ✓ | ✗ |
| `claude -p`, Agent SDK | ✓ | ✗ |
| Remote Control (web/mobile) | ✓ (on your machine) | only in the local terminal |
| Cloud sessions | ✓ if the plugin reaches them | ✗ |

**[!] Surface discrepancy.** REF says `e.surface` is `terminal` or `desktop`. DTS declares `RenderSurface = 'terminal' | 'desktop' | 'mobile' | 'vscode'`, and BREF describes the mobile and vscode element tables (mobile has no Input/Select/Client; vscode has no Client). **[I]** Mobile and VS Code drawing are typed for the future but not shipped in 2.1.287.

---

## 5. AFTER a turn

| Event | Notes | Src |
|---|---|---|
| `turn.complete` | Fires when a turn ends, including interrupted turns (`isAborted`) and subagent turns (`agentId`). Carries `answer`, `durationMs`, `usage`. Can return `{text}` to show a line under the answer. There is **no `turn.stop` event**: the "Stop" moment is `turn.complete`, or `classic.Stop` for parity with settings hooks. | EV |
| `session.measure` | After each turn, and when plan-limit percent changes | REF |
| `session.append` | Once per row the conversation stores (prompt, response block, tool result, notice, compaction summary…), main and subagents. Hooks can rewrite `content` only (for example to redact). A row can't be refused. `$.session.append` adds meta/system rows. | REF, BREF |
| `session.compact` | `e.trigger` ∈ `manual`/`auto`/`plugin`/`precompute`. Hooks can rewrite `instructions`/`messages`, answer with their own compaction, or `{skip}`. A classic PreCompact block also produces a skip. | REF, DTS |
| `session.send` / `session.receive` | Cross-session/subagent messages: `{consumed}`, or `{isDelivered:false}` | API |
| `session.end` | On exit, `/clear`, `/resume`, `/branch` (`reason`). **All `session.end` hooks share 1.5 s.** | REF |
| `/clear`, `/resume`, `/branch` | Reset `$.state` to defaults. `session.start` does **not** refire, so reload from `$.store` in `classic.SessionStart {source: clear/resume/fork}`. | UI, TS |

---

## 6. DURABLY: what persists where **[D]** UI, REF, API

| Tier | Lifetime | Scope | Mechanics |
|---|---|---|---|
| Module variables | Until reload | One module instance | Plain JS. Shared by all hooks in the file (OV's "share data between hooks"). |
| `$.state` | Session; survives reload; reset by `/clear` `/resume` `/branch` | Per session, host-held | Reactive: a read in `ui.render` subscribes the site and a write redraws it. Values are versioned and `update()` uses `ifVersion` with retry. Render hooks can't write. Only the owner writes; others intercept the `state.set` event (BREF). Must be declared in `PluginState` in `types/index.d.ts` with literal `plugin`/`key`. Helpers: `atom`, `read`, `update`, `derive`, `memberOf` (families). |
| `$.store` | Across sessions until deleted, or until unused for `cleanupPeriodDays` | **All sessions on the machine** for this plugin | JSON file per plugin under `~/.claude/plugins/store/`, 4 MiB total. get/set are **not atomic** across sessions, so use per-item keys and re-read before writing. |
| `$.fs` | Disk | User permissions | `write` is not atomic, max 4 MiB per file |
| Generated types, dev-mods | `.claude-plugin/types/` is rewritten per load; `~/.claude/dev-mods/<session>/` is cleaned after `cleanupPeriodDays` | | CR |

**Type contracts.** `types/index.d.ts` (named in `plugin.json` `"types"`) declares `PluginState` and any `EngineInterface` namespace. `validate` fails `x.y is not declared`. **[D]** UI, B2, BREF

---

## 7. The middleware chain

### Order **[D]** EV, ADM, REF

```
OUTERMOST (sees event first, result last)
  1. prepend tier: sec-default@builtin (if it loads) + prependPlugins in listed order + other org mods not in appendPlugins
  2. user tier: mods the user installed (a mod runs before the mods it lists in `dependencies`)
  3. append tier: appendPlugins
  4. builtin tier: other built-in mods (agents-md, diff, telemetry…)
  5. core: Claude Code's own behaviour ({plugin:'engine', tier:'core'})
INNERMOST
Within one module: the order `on` was called.
```
- Setting `prependPlugins` *replaces* the default, so you must list `sec-default@builtin` yourself to keep the guard. Repo settings can never set these lists. **[D]** ADM
- `next.to(e, 'append'|'builtin'|'core')` lets prepend/append mods skip the user tier. `next.origin` tells you who fired the event. Every `$` call is itself an event (`fs.read`, `model.complete`…), so mods earlier in the chain can audit, rewrite or deny later mods' calls. **[D]** REF, API
- For the band (`AbovePrompt`), returning a tree hides what later mods draw unless you embed `await next(e)`. **[D]** UI
- **[!]** B1 simplifies the order to "they run in the order they load". The real rule is tier-based, as above.
- Test kit: hooks a test registers sit *beneath* the mod and stand in for core. **[D]** B2, BREF

### Failure modes (draw as a decision tree) **[D]** EV, TS, ADM, REF

| Failure | Result | Open/closed |
|---|---|---|
| Hook throws, times out (10 s of own time) or returns the wrong shape **before** `next` | Skipped; the next handler runs in its place | **Fail-open** |
| Same failure **after** `next` resolved | That result stands; nothing runs twice | n/a |
| `.catch(handler)` registered | Handler runs (1 s budget) with `next.error.kind` = throw/timeout and can `{deny}` | **Fail-closed by choice** |
| `plugin.register` policy check throws | Skipped, so the checked mod loads | Fail-open unless `.catch` |
| sec-default can't read managed settings or check deny rules | Refuses user mods / refuses the call | **Fail-closed** |
| `$.ui.ask` hook times out while holding a call | Hook skipped, so **the held command runs** | Fail-open (EV warns) |
| `ui.render` tree invalid (bad element/prop/child) | Engine draws its own version; logs `…refused: … the engine drew its own` | Graceful |
| `session.append` hook answers without `next` | Skipped; row kept ("never refused") | — |
| Top-level module code throws | `hooks module did not load` | — |
| Bad reload | Previous version stays | — |
| Hook blocks the worker thread | Mod unloaded: "crashed the hooks worker" | — |
| Worker crashes 3× with no single culprit | **All non-built-in mods unloaded, org policy mods included**, until `/reload-plugins` | Fail-open for policy **[D]** ADM |
| Timer callback throws | Logged; the timer runs again next interval | — |
| Unanswered registered command | "registered /x but no command.run hook answered it" | — |

Error visibility: a dim transcript line in hot-reload sessions, otherwise the `--debug` log only. `-p` writes to stderr. **[D]** TS

### Limits **[D]** REF
Hook 10 s of own time · `.catch` 1 s · all `session.end` 1.5 s · `$.process.run` 30 s default, 10 min max · `$.model.complete` maxTokens 1024 default · fs 4 MiB/file · store 4 MiB · Text child 10k chars · `messages()` newest 4,096 · names `[A-Za-z0-9_-]{≤64}` · test 5 s.

---

## 8. Tooling **[D]** CR, TEST, REF, TS

- `claude plugin validate <dir> [--strict] [--json]`: manifest plus static analysis. It rejects names that look like Anthropic's (for example a `claude-` prefix). **[!]** This project is named `claude-mods`, so any sample plugin we build must not start with `claude-`.
- `claude plugin test [dir]`: runs `*.test.ts` against the real engine with no session, network or sign-in. `claude-code/testing` provides `test`, `expect`, `mock.clock`, `$.ui.mount({surface})`, `press/input/find`. Exits 1 on failure, so it fits CI. Run it in an empty dir to check whether mods can load at all.
- `tsc -p <mod>` works off the generated `tsconfig.json`. The authoritative API is the per-build `claude-code/index.d.ts`, which is trusted over the docs.
- `claude --debug` / `--debug-file`, plus `/plugin` (shows "N mods active · names"; built-ins listed separately).
- Publishing: a marketplace (`.claude-plugin/marketplace.json`, git repo, or directory), `/plugin marketplace add`, then install and `/reload-plugins`. Or submit to the Claude directory (claude.ai/directory/manage). Version bumps matter because installs are cached by version. **[D]** CR, B2, B1

---

## 9. Other discrepancies and gaps noticed

1. **[!] WN has no mods entry.** The What's-new digest stops at Week 37 (Sept 7–11), and w38–w40 return 404. The launch is in the changelog and GitHub release (`REL`, appended to `WN`) as the single line "Added Claude Mods: plugins may now modify deeper behavior".
2. **[!] Code style in B2.** B2 sample hooks are sometimes sync and use `children: "string"`, while the docs always use async functions and `children: [...]`. B2 also calls `$.state.get(ref)` directly where UI uses the `atom/read/update` helpers. **[I]** Both styles are accepted; BREF documents raw `$.state.get`.
3. **[!] B1 order claim.** As noted in §7, B1's "order they load" glosses over the tier system.
4. **`session.start` vs `/clear`.** REF says it doesn't refire after `/clear`/`/resume`/`/branch`, and BREF confirms `session.end{reason:'clear'}` with no `session.start` after it. That is a trap for state-loading code.
5. **`$.fs`/`$.process` bypass deny rules** (`Read(.env)` doesn't stop `$.fs.read`). Org network policy covers `$.http.fetch` but not processes a mod spawns. **[D]** ADM
6. REF links a `/docs/en/plugins/mods/gallery` page. I saved it as `mods-gallery.md` but didn't analyse it.
7. **[I]** "Installed mods share one worker thread" (TS) together with the debug line `(worker, environment 2…)` suggests one worker with a separate JS environment (realm) per module. Built-in mods seem to run elsewhere, since they survive worker crashes.
