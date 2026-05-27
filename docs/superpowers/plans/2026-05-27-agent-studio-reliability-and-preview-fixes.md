# Agent Studio Reliability And Preview Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix the post-checkpoint issues without breaking the protected `.ogdoc` agent-to-studio workflow.

**Architecture:** Preserve the current document-first `.ogdoc` flow as the baseline. Add narrow session-state semantics for waiting and publish confirmation, make platform preview/rendering use the same effect model as canvas/export, and either make Source-panel agent requests session-visible or remove them from the main workflow.

**Tech Stack:** TypeScript, npm workspaces, React/Vite Studio, Konva canvas, SVG renderer, Node CLI, local file-based sessions.

---

## Research And Diagnosis Summary

- npm/npx release behavior should be stable if the package keeps a valid `bin`, includes `studio-dist` and `codex-skill`, and passes packed-install smoke tests. npm docs say `npx` runs commands from local or remote packages and places fetched packages on `PATH`; if a package has one `bin` entry, npm can infer the command.
- Current package coverage is good but incomplete for one release risk: `scripts/package-install-smoke.mjs` tests packed install, skill install, document validate, export, and publish preview, but it should also test `npx`-style CLI-only export from the installed `@graphforge/cli` package without separately installing workspace tarballs.
- Claude Code can be forced to continue with Stop hooks, but Codex/OpenCode do not expose the same standard hook behavior in this repo. Therefore the app must not depend on every agent literally waiting forever. The reliable cross-agent contract is durable session files plus `graphforge session wait --until ...`; hooks can be optional agent-specific hardening.
- Current `graphforge session wait` exits as soon as there is any export or publish request. That is too early for the desired workflow because export and preview are not the final â€œpublish confirmedâ€ state.
- Current Studio â€œCreate publish previewâ€ writes `publish-request.json` with status `preview`. There is no Studio UI action that writes a confirmed publish request, so an agent checking status is correct to report â€œPublish is still only preview.â€
- Current Source-panel â€œAgent requestâ€ creates a generic agent handoff in the Studio library root, not a session-scoped event/request inside `.graphforge/sessions/<id>/`. In an agent session this is not an effective bridge.
- Platform preview renders through `renderProjectToSvg(project)`, while the canvas renders through Konva. Some effects are supported in both, but not consistently for all layer kinds. In particular, noise/lighting/vignette overlays are canvas-visible for image layers but SVG renderer overlays are currently shape/background-oriented, so platform preview/export can miss effects the editing canvas shows.
- Platform preview layout currently uses fixed min-heights and a single switcher pattern for all platforms. This makes some platform frames shrink or overflow instead of behaving like a stable inspector surface.

## Protected Baseline

Do not change this behavior except to make it more reliable:

1. Skill asks relevant design questions.
2. Agent creates a session.
3. Agent generates editable layered `.ogdoc`.
4. Agent launches Studio with `graphforge session launch`.
5. Studio opens and saves the same session document.
6. Studio exports optimized OG raster into the target app repo.
7. Studio writes session handoff files so the agent can resume.

Every task below must keep this flow passing.

## File Map

- `packages/core/src/index.ts`: session and publish request types; add explicit wait target/status types if needed.
- `packages/cli/src/session.ts`: session transitions, publish request creation, confirmed publish events.
- `packages/cli/src/index.ts`: `session wait` options, `publish` command behavior, optional `session confirm-publish` command.
- `packages/cli/src/server.ts`: Studio API endpoints for publish preview, publish confirmation, and session-scoped agent requests.
- `packages/studio/src/api.ts`: client calls for confirmed publish and agent request.
- `packages/studio/src/ui/ExportPublishPanel.tsx`: split export, preview, confirm, and agent handoff actions.
- `packages/studio/src/ui/SourceRail.tsx`: remove or replace ineffective Agent request box.
- `packages/render/src/browser.ts`: make SVG renderer effect parity match canvas for text/image/shape/background.
- `packages/studio/src/ui/ArtboardEditor.tsx`: keep canvas effect behavior as reference, adjust only if renderer parity needs shared helpers.
- `packages/studio/src/ui/PlatformPreviewPanel.tsx`: stable platform layouts, correct scroll ownership, current image/effects preview.
- `packages/studio/src/platforms.ts`: platform-specific sizing/chrome metadata.
- `scripts/studio-smoke.mjs`: browser verification for effect parity and platform preview layout.
- `scripts/package-install-smoke.mjs`: packed/npx-like CLI-only smoke coverage.
- `packages/*/*.test.ts`: focused unit/integration regression tests.
- `packages/codex-skill/SKILL.md` and `packages/cli/codex-skill/SKILL.md`: stronger wait/publish instructions.
- `AGENTS.md`: update protected-baseline notes only if architecture semantics change.

---

### Task 1: Lock npm/npx Release Parity

**Files:**
- Modify: `scripts/package-install-smoke.mjs`
- Modify: `packages/cli/src/packaging.test.ts`

- [x] Add a CLI-only packed install test path that installs only the packed `@graphforge/cli` tarball into `cliOnlyAppDir`.
- [x] From that CLI-only app, run:
  - `graphforge doctor --json`
  - `graphforge new --name CliOnly --strategy common --mode template --out cli-only.og.json`
  - `graphforge document pack --project cli-only.og.json --out cli-only.ogdoc`
  - `graphforge export --project cli-only.og.json --format png --out public/og.png`
- [x] Assert the exported PNG exists, is `1200x630`, is nonblank, and no provider key is required.
- [x] Add a packaging unit assertion that `packages/cli/package.json` keeps `bin.graphforge`, `files` containing `dist`, `studio-dist`, and `codex-skill`, and bundled `@graphforge/core` / `@graphforge/render`.
- [x] Run `npm run smoke:package`.
- [x] Expected result: the package behaves the same when installed as a packed package as it does from the workspace.

### Task 2: Make Session Wait Targeted And Agent-Safe

**Files:**
- Modify: `packages/cli/src/session.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/src/session.test.ts`
- Modify: `packages/cli/src/cli.test.ts`
- Modify: `packages/codex-skill/SKILL.md`
- Modify: `packages/cli/codex-skill/SKILL.md`

- [x] Add `--until` support to `graphforge session wait`.
- [x] Supported values:
  - `exported`: returns after an export exists.
  - `publish-preview`: returns after a preview publish request exists.
  - `publish-confirmed`: returns only after a confirmed publish request exists.
  - `agent-request`: returns after a session-scoped agent request exists.
  - `terminal`: returns after confirmed publish or explicit cancel/stop event.
- [x] Add `--timeout 0` or `--timeout never` support for indefinite local waits.
- [x] Preserve current default behavior for compatibility, but update the skill to use `--until publish-confirmed --timeout 0`.
- [x] Add tests proving `session wait --until publish-confirmed` does not exit on export or preview.
- [x] Add tests proving it exits when `publishRequests` contains `status: "confirmed"`.
- [x] Update skill text to say agents should keep the wait command running or repeat it until confirmed publish/cancel.
- [x] Document limitation: all agents can use durable wait files, but only some agents can be hard-prevented from ending via native hooks.

### Task 3: Fix Publish Semantics In Studio

**Files:**
- Modify: `packages/cli/src/server.ts`
- Modify: `packages/cli/src/session.ts`
- Modify: `packages/studio/src/api.ts`
- Modify: `packages/studio/src/ui/ExportPublishPanel.tsx`
- Modify: `packages/cli/src/server.test.ts`
- Modify: `packages/studio/src/api.test.ts`
- Modify: `scripts/workflow-smoke.mjs`
- Modify: `scripts/package-install-smoke.mjs`

- [x] Keep `Create publish preview` mutation-free.
- [x] Add a second explicit action: `Confirm publish handoff`.
- [x] The confirm action must write a `publish-request.json` with `status: "confirmed"` and append a `session.publish.confirmed` event.
- [x] If the app is in agent-session mode, the confirm action should not silently mutate metadata unless this product decision is explicitly changed. It should hand off to the agent via confirmed session state.
- [x] If a future direct-apply option is added, it must be a separate button or modal choice such as `Apply metadata locally`, not hidden inside preview.
- [x] Add UI state:
  - before export: confirm disabled with reason â€œExport first.â€
  - after export: preview enabled.
  - after preview: confirm handoff enabled.
  - after confirm: show â€œWaiting for agent to wire metadata.â€
- [x] Add tests verifying preview remains `preview`, confirm writes `confirmed`, and session status becomes `published` or `publish-confirmed`.
- [x] Update smoke workflow to simulate export, preview, confirm, then agent reads confirmed status.

### Task 4: Replace The Ineffective Source Agent Request

**Files:**
- Modify: `packages/studio/src/ui/SourceRail.tsx`
- Modify: `packages/studio/src/api.ts`
- Modify: `packages/cli/src/server.ts`
- Modify: `packages/cli/src/session.ts`
- Modify: `packages/studio/src/api.test.ts`
- Modify: `packages/cli/src/server.test.ts`

- [x] Remove the current generic â€œAgent requestâ€ box from the Source rail or move it out of the source-import area.
- [x] Add a session-scoped `Request agent revision` surface only when `session` exists.
- [x] On request:
  - save current `.ogdoc`
  - write `.graphforge/sessions/<id>/agent-request.json`
  - append an `agent.requested` event with prompt, document path, and expected output
  - set `pendingAction` to `agent-revise-document`
- [x] If no session exists, hide the control or show a disabled state: â€œOpen through an agent session to request revisions.â€
- [x] Make `session wait --until agent-request` return when this file/event appears.
- [x] Add tests proving agent requests are recoverable from session files.

### Task 5: Make Preview Effects Match Canvas And Export

**Files:**
- Modify: `packages/render/src/browser.ts`
- Modify: `packages/render/src/render.test.ts`
- Modify: `packages/studio/src/ui/ArtboardEditor.tsx` only if shared helper extraction is needed.
- Modify: `scripts/studio-smoke.mjs`

- [x] Define one effect support matrix for `text`, `badge`, `shape`, `background`, `image`, `logo`, and `screenshot`.
- [x] Implement SVG renderer parity for:
  - glow on text/object/image
  - blur on all visual layer types
  - gradient on shape/background
  - noise clipped to the layer bounds for image/shape/background
  - lighting/vignette clipped to image/shape/background
  - blend mode where SVG/browser support allows it
- [x] Fix image-layer effect overlays in SVG so they use clip paths matching image bounds/crop/radius.
- [x] Add render tests that inspect SVG for the expected filter/clip/overlay IDs for image noise and glow.
- [x] Add browser smoke that:
  - applies noise/glow to an image layer
  - switches to platform preview
  - verifies the platform preview SVG changes
  - verifies the exported raster also changes and remains nonblank.

### Task 6: Redesign Platform Preview As A Stable Inspector

**Files:**
- Modify: `packages/studio/src/ui/PlatformPreviewPanel.tsx`
- Modify: `packages/studio/src/platforms.ts`
- Modify: `packages/studio/src/styles.css`
- Modify: `scripts/studio-smoke.mjs`
- Modify: `packages/studio/src/platforms.test.ts`

- [x] Replace the fragile frame sizing with platform-specific frame specs:
  - feed large card: X, LinkedIn, Facebook
  - chat embed: Discord, Slack
  - mobile message: WhatsApp, iMessage
  - browser/search result: generic browser
- [x] Keep the rendered OG image size consistent inside each platform frame; only chrome and metadata layout should change.
- [x] Put platform switcher in a compact top or side rail within the preview inspector, not as a card wall that steals vertical space.
- [x] Use one owned scroll container inside `.platform-preview-body`; avoid body-level scroll and hidden clipped content.
- [x] Add smoke checks for every platform tab:
  - tab switches without layout jump beyond a small threshold
  - preview image is visible
  - frame and switcher stay inside the dock
  - no horizontal overflow at desktop and compact widths.

### Task 7: Add Agent-Specific Waiting Hardening

**Files:**
- Modify: `packages/codex-skill/references/agent-handoff.md`
- Modify: `packages/cli/codex-skill/references/agent-handoff.md`
- Create: `packages/codex-skill/references/agent-waiting.md`
- Create: `packages/cli/codex-skill/references/agent-waiting.md`
- Optional create: `packages/codex-skill/hooks/claude-stop-wait.example.json`
- Optional create: `packages/cli/codex-skill/hooks/claude-stop-wait.example.json`

- [x] Document cross-agent baseline: durable files and `graphforge session wait --until publish-confirmed`.
- [x] Document Codex behavior: skill must explicitly run the wait command and resume from session files if interrupted.
- [x] Document Claude Code optional hardening: Stop hooks can prevent stopping, but they are agent-specific and not portable to all agents.
- [x] Do not require hooks for v1 correctness.
- [x] Add skill tests asserting the wait command uses `--until publish-confirmed` and mentions recovery after interruption.

### Task 8: End-To-End Verification

**Files:**
- Modify: `scripts/studio-smoke.mjs`
- Modify: `scripts/workflow-smoke.mjs`
- Modify: `scripts/package-install-smoke.mjs`
- Modify tests as needed.

- [x] Run and inspect:
  - `npm run build`
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run smoke:workflow`
  - `npm run smoke:agent-handoff`
  - `npm run smoke:package`
  - `npm run smoke:studio`
  - `npm pack -w @graphforge/cli --dry-run`
- [x] Browser-use manual flow:
  - create session
  - generate/pack `.ogdoc`
  - launch Studio
  - edit a text layer
  - apply image noise and glow
  - verify canvas and platform preview both update
  - export `public/og.png`
  - create preview
  - confirm publish handoff
  - run `graphforge session wait --until publish-confirmed --timeout 5000`
  - verify wait returns confirmed session
  - verify agent can call `graphforge publish --confirm --repo <repo> --session <id> --image public/og.png` and metadata changes only after confirmation.
- [x] Commit after the full gate passes.

## Acceptance Criteria

- Packed npm install behaves like local workspace for CLI, Studio assets, skill install, `.ogdoc`, export, and publish handoff.
- Agents have a deterministic session wait target and do not treat preview as final publish.
- Studio has an explicit confirmed publish handoff action.
- Platform preview shows the current rendered image and supported effects in real time.
- Broken platform preview layouts are covered by tab-by-tab browser smoke tests.
- Source-panel agent request is either removed or made truly session-scoped and agent-visible.
- The checkpoint commit `9e6953c` remains a protected fallback.

