# OpenGraph Creator

OpenGraph Creator is a local, agent-first Open Graph finishing studio for app repositories. Codex, Claude Code, OpenCode, or another coding agent inspects the user's app, creates an editable `.ogdoc` document, opens Studio, waits for the user's decision, and resumes only after the user confirms the publish handoff.

OpenGraph Creator is not an AI provider client. It does not require OpenAI, Anthropic, or image-generation API keys. The coding agent owns generation. Studio owns editing, preview, export quality, compression, recovery, and handoff files.

## Product Model

- `.ogdoc` is the editable master document and the only default session source of truth.
- PNG, WebP, JPEG, SVG, HTML, and JSON can be imported as assets or exported outputs, but they do not replace `.ogdoc` unless the user chooses pure-image fallback.
- Sessions are file-based under `.opengraph-creator/sessions/<id>/` so Codex, Claude Code, and OpenCode can recover from the same state.
- Metadata is never changed by Studio alone. The agent wires metadata only after preview and explicit confirmation.
- Platform preview and export use the same renderer path. The editing canvas must keep effect parity with that renderer.

## Install And Launch

Development checkout:

```bash
npm install
npm run build
npm run opengraph-creator -- doctor
npm run opengraph-creator -- studio --repo .
```

Skill install and packaged runtime after release:

```bash
npx skills add -g your-org/opengraph-creator --skill opengraph-creator -y
npx -y opengraph-creator@latest doctor --json
npx -y opengraph-creator@latest studio --repo .
```

The skills CLI is the primary install path for users. The installed skill runs the Studio/CLI runtime through `npx -y opengraph-creator@latest`. If a local skills installer cannot target a specific agent automatically, use the fallback `opengraph-creator install-skill --agent codex|claude-code|opencode --scope global` command only for local development or recovery.

Manual launch opens the Project Hub. Agent launch opens the generated session `.ogdoc` directly.

## Agent Workflow

The installed skill should:

1. Inspect framework, routes, metadata, brand assets, screenshots, and copy.
2. Ask only relevant designer-style questions: common/per-page/hybrid strategy, output mode, visual tone, pages, references, and final format.
3. Create a durable session.
4. Generate `.opengraph-creator/sessions/<id>/document.ogdoc` with editable layers by default.
5. Validate the document.
6. Launch Studio.
7. Wait for the next Studio decision.

```bash
opengraph-creator session create --repo . --agent codex --strategy hybrid --mode template
opengraph-creator document validate --source ".opengraph-creator/sessions/<id>/document.ogdoc"
opengraph-creator session launch --repo . --id "<id>" --open true --waitReady true --json
opengraph-creator session wait --repo . --id "<id>" --until next-action --timeout 0
```

When `next-action` returns:

- `agent-requested`: read `agent-request.json`, revise `document.ogdoc`, validate, relaunch Studio, and wait again.
- `published`: read confirmed `publish-request.json`, preview the metadata change, then wire it into the app.
- `cancelled` or `terminal`: stop without metadata mutation.

## Session Files

```text
.opengraph-creator/sessions/<id>/
  session.json
  events.jsonl
  document.ogdoc
  incoming/
  export.json
  publish-request.json
  agent-request.json
  studio.json
```

These files are the recovery contract. If an agent process stops, rerun the skill and resume from the session folder.

## Studio Capabilities

- Project Hub for direct CLI launch, repo launch, recovery, and recent documents.
- Layered Konva canvas for text, image, logo, screenshot, shape, badge, and background layers.
- One canvas-side object toolbar for adding elements.
- Layer panel for selecting, reordering, hiding, locking, duplicating, deleting, aligning, and distributing layers.
- Undo/redo with bounded lightweight history and keyboard shortcuts.
- Image upload, replacement, crop, focal point, fit mode, and asset packaging.
- Typography controls for font, size, weight, style, color, line height, letter spacing, stroke, and stroke width.
- Shape controls for fill, border, radius, opacity, rotation, skew/perspective, snap, and transform.
- Effects for supported layer types: blur, shadow, glow, gradient, noise/grain, lighting, vignette, and blend mode.
- Platform previews for X/Twitter, LinkedIn, Facebook, Discord, Slack, WhatsApp, iMessage, and browser/search.
- Export to exact `1200x630` PNG, WebP, JPEG, or SVG source.

Unsupported layer/effect combinations must be hidden or disabled with a clear reason. They must not appear as fake-functional controls.

## Effect Parity Contract

OpenGraph Creator has three visual surfaces: Studio canvas, platform preview, and export. A supported effect is complete only when all three surfaces reflect the same serialized `.ogdoc` state.

- Preview/export use the OpenGraph Creator SVG renderer as the source of truth.
- Canvas uses Konva for interaction, but must not silently approximate blur as a shadow.
- Blur must use real canvas filtering with cache invalidation.
- Glow, shadow, noise, lighting, and vignette must be clipped to the intended layer bounds.
- Browser smoke tests must cover live effect changes before a fix is considered complete.

## Export And Publish

Default final output:

```bash
opengraph-creator export --project project.og.json --format png --out public/og.png
```

Optional outputs:

```bash
opengraph-creator export --project project.og.json --format webp --quality 82 --out public/og.webp
opengraph-creator export --project project.og.json --format jpg --quality 82 --out public/og.jpg
opengraph-creator render --project project.og.json --out public/og.svg
```

Publish flow:

```bash
opengraph-creator publish --preview --repo . --session "<id>" --framework next --image public/og.png
opengraph-creator publish --confirm --repo . --session "<id>" --framework next --image public/og.png
```

Preview writes a handoff request only. Confirm writes the agent handoff state. The coding agent is responsible for applying metadata safely.

## Package Layout

- `packages/core`: schema, presets, validation, platform warnings, effect capabilities, and `.ogdoc` package support.
- `packages/render`: SVG renderer and PNG/WebP/JPEG export pipeline.
- `packages/studio`: React/Vite creative-tool interface.
- `packages/cli`: CLI, local Studio server, sessions, packaging, skill install, publish helpers.
- `skills/opengraph-creator`: public skills.sh-compatible skill package.
- `packages/codex-skill` and `packages/cli/codex-skill`: skill source and packaged copy.
- `scripts`: workflow, package, handoff, agent, and Studio smoke tests.

## Release Gate

Before release or before claiming a workflow fix:

```bash
npm run build
npm test
npm run typecheck
npm run lint
npm run smoke:workflow
npm run smoke:agent-handoff
npm run smoke:agent-next-action
npm run smoke:package
npm run smoke:studio
npm pack -w opengraph-creator --dry-run
```

The gate must prove: no provider-key requirement, packed/npx-style install works, agent session handoff works, Studio opens the generated `.ogdoc`, effects update live, platform previews stay stable, final raster exports are exact `1200x630`, and output is nonblank.

## Boundaries

- OpenGraph Creator coordinates agent workflows; it does not call provider APIs.
- Studio is an OG finishing tool, not a general-purpose design suite.
- Platform previews are local simulations. Deployed URLs should still be checked with live social validators before launch.
- Dynamic framework metadata may still require human review after OpenGraph Creator writes a confirmed handoff.
