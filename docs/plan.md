# GraphForge Agent-First Re-Engineering Plan

## Summary
GraphForge is a local `npx` + Skill powered Open Graph finishing studio. The user coding agent is the brain: Codex, Claude, or OpenCode asks the user design questions, scans the target repo, generates editable OG source assets, opens Studio, waits for Studio events, and wires the final exported image into the app only after user confirmation.

Studio is not an AI provider client. Studio receives agent-created JSON, SVG, HTML, or image assets; lets the user edit them visually; previews social/platform crops; exports optimized OG images; and writes durable handoff files so the agent can continue even after crashes or restarts.

Keep Vite + Node CLI for v1. Do not migrate to Next.js yet. The app is local-first, bundled into the CLI, and must stay simple to run with `npx @graphforge/cli studio`.

## Product Requirements

- Install and launch must stay simple:
  - `npx @graphforge/cli studio`
  - `npx @graphforge/cli install-skill --agent codex|claude|opencode|all`
- GraphForge must not require OpenAI, Anthropic, or image-provider API keys.
- Agents generate the initial OG assets. Studio edits, previews, exports, and requests publish handoff.
- The bridge between agent and Studio is file-based for v1:
  - `.graphforge/sessions/<id>/session.json`
  - `.graphforge/sessions/<id>/events.jsonl`
  - `.graphforge/sessions/<id>/incoming/`
  - `.graphforge/sessions/<id>/project.og.json`
  - `.graphforge/sessions/<id>/export.json`
  - `.graphforge/sessions/<id>/publish-request.json`
- The agent Skill must instruct the agent to:
  - inspect the repo, routes, brand, assets, screenshots, and metadata
  - ask situational questions about common/per-page/hybrid strategy, template vs pure image, references, target pages, and desired tone
  - generate editable layered assets when practical
  - place generated assets in the session folder
  - open Studio with `?session=<id>`
  - wait for export or publish events
  - recover from session files if interrupted
  - publish only after preview and explicit confirmation

## Studio UX And UI Direction

- Redesign the current UI completely. Do not reuse the green theme or immature preview wall.
- Use a professional creative-tool style:
  - matte graphite command chrome
  - warm neutral canvas surface
  - one restrained bright accent for focus and active tools
  - compact typography, dense but calm panels, no decorative filler
  - no generic AI gradients, vague labels, fake controls, or nonfunctional buttons
- Use shadcn/Radix-style primitives where useful:
  - resizable panels
  - scroll areas
  - toolbar
  - tooltip
  - tabs
  - slider
  - switch
  - select
  - dialog or sheet
  - sonner toasts
- Use lucide icons for clear tool actions.
- Own every scroll region. The body should not become a messy scroll surface on desktop.
- Layout target:
  - top command bar: project/session state, source toggle, save, export, publish
  - left rail: project/session/source, collapsible
  - center: canvas-only editing workspace with zoom and fit controls
  - right inspector: tabs for Layers, Inspector, Effects, Export
  - platform preview: dedicated side drawer or bottom sheet, not permanently below the canvas

## Functional Rebuild

- Remove generic repeated startup template behavior:
  - `?session=<id>` opens the session project
  - `?project=<id>` opens that project
  - normal launch shows the project picker
  - empty library shows import/connect/manual draft options
- Fix current critical UI bugs:
  - every button must use `type="button"` unless it is a real submit button
  - no button click may refresh or reset the app
  - layer panel must be visible and scrollable
  - canvas must get most of the editing space
  - uploaded/generated image layers must render real images, not placeholder boxes
- Add real editing tools:
  - text, image, shape, badge, background, rectangle, rounded rectangle, ellipse, line/divider
  - upload/replace image
  - crop, focal point, fit mode
  - font family, weight, style, size, color, line height, letter spacing
  - fill, border, radius, opacity, rotation, skew/perspective
  - glow, shadow, blur, gradient, noise/grain, lighting, vignette, blend mode
  - align, distribute, snap, duplicate, lock, hide, reorder, delete
- Keep Konva for interaction:
  - select, drag, resize, rotate through `react-konva` and `Konva.Transformer`
  - normalize `scaleX/scaleY` into width/height after transform
  - keep GraphForge renderer as export source of truth
  - ensure renderer output matches Studio preview for supported layer properties

## Platform Preview

- Replace the current preview wall completely.
- Add platform previews for:
  - X / Twitter
  - LinkedIn
  - Facebook
  - Discord
  - Slack
  - WhatsApp
  - iMessage
  - Browser/Search
- Each preview must:
  - use the current rendered image
  - show platform identity clearly
  - use the correct crop/aspect shell
  - show title/description where relevant
  - show compact resolution and file-size state
  - surface safe-zone, crop, contrast, and hidden-layer warnings without noisy text

## Export And Publish

- Default publish output is raster:
  - `public/og.png`
  - exact `1200x630`
- Optional outputs:
  - `public/og.webp`
  - `public/og.jpg`
  - SVG as source/template/export, not default metadata image
- Compression defaults:
  - PNG compression level 9 with adaptive filtering
  - WebP quality 82, effort 5
  - JPEG quality 82, progressive where supported
- Export validation:
  - warn above 1 MB
  - error above 5 MB
  - verify exact dimensions
  - verify nonblank raster output
  - ensure metadata target points to the selected raster file

## Public Interfaces

- Project schema must support:
  - `schemaVersion`
  - `sessionId`
  - text `letterSpacing`, `fontStyle`, `stroke`, `strokeWidth`
  - transform `skewX`, `skewY`, optional image perspective data
  - image crop and focal point fields
- Session schema must support:
  - `id`
  - `repo`
  - `agent`
  - `strategy`
  - `mode`
  - `status`
  - `activeProjectId`
  - `incomingArtifacts`
  - `exports`
  - `publishRequests`
  - `lastHeartbeatAt`
  - `pendingAction`
  - `recoverInstructions`
- Local API endpoints must support:
  - `GET /api/session`
  - `POST /api/session`
  - `POST /api/session/event`
  - `POST /api/session/export`
  - `POST /api/session/publish-request`

## Test And Verification Plan

- Unit tests:
  - session create/read/write/recover
  - event log append and heartbeat stale detection
  - no generic startup project unless user starts manual draft
  - layer add/edit/delete/reorder/hide/lock
  - crop/focal/perspective clamping
  - renderer parity for text stroke, letter spacing, font style, image crop, and effects
- CLI tests:
  - `graphforge session create/open/wait/status`
  - `graphforge install-skill --agent codex|claude|opencode|all`
  - publish preview does not mutate app files
  - publish confirm backs up and writes metadata
  - no provider key requirement
- Studio flow tests:
  - open with no session and see project picker
  - open with session and load correct project
  - click every visible button or verify disabled reason
  - add text/image/shape and see canvas update
  - import file, upload image, export image, create publish request
  - no full UI refresh on button click
- Visual/layout tests:
  - desktop, laptop, tablet, and mobile screenshots
  - no horizontal overflow
  - layer panel visible and scrollable
  - canvas has enough editing space
  - preview drawer/sheet aligns and shows current image
  - scrollbars are styled and limited to owned panels
- Export/package tests:
  - PNG/WebP/JPEG exact `1200x630`
  - output is nonblank
  - compression changes file size
  - `npm pack -w @graphforge/cli --dry-run`
  - installed tarball launches Studio and installs skills

## Implementation Order

1. Save this plan and create `AGENTS.md`.
2. Add failing tests for the current workflow, UI, renderer, and export gaps.
3. Fix editor model and renderer parity.
4. Rebuild Studio shell layout and design tokens.
5. Replace preview panel with platform-specific preview drawer/sheet.
6. Harden session bridge and agent handoff events.
7. Run full unit, build, lint, package, smoke, and visual verification.

## Assumptions

- V1 stays local-first, open-source-first, and `npx`-first.
- Files are the universal agent bridge.
- MCP is a future enhancement, not a v1 dependency.
- Konva is used only for editing interaction.
- GraphForge renderer remains export source of truth.
- Studio never applies metadata without preview and confirmation.
