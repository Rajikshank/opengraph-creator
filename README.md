# GraphForge OG Studio

GraphForge is a local, agent-first Open Graph finishing studio for app repositories. A coding agent such as Codex, Claude Code, or OpenCode scans the user's app, generates an editable `.ogdoc` document, opens Studio, waits for the user's decision, then resumes to wire the final image into the app after confirmation.

GraphForge is not an AI provider client. It does not require OpenAI, Anthropic, or image-generation API keys. The agent does the generation work; Studio handles editing, preview, export, compression, and durable handoff.

## Core Model

- `.ogdoc` is the editable master document, similar to a lightweight PSD-style package.
- PNG, WebP, JPEG, SVG, and HTML can be imported as assets or exported as final output.
- The bridge between agent and Studio is file-based under `.graphforge/sessions/<id>/`.
- The agent waits with `graphforge session wait --until next-action`, so the same flow works across Codex, Claude Code, and OpenCode.
- Metadata is changed only after preview and explicit confirmation.

## Install And Launch

Development checkout:

```bash
npm install
npm run build
npm run graphforge -- doctor
npm run graphforge -- studio --repo .
```

Packaged usage after release:

```bash
npx @graphforge/cli doctor
npx @graphforge/cli studio --repo .
npx @graphforge/cli install-skill --agent codex
npx @graphforge/cli install-skill --agent claude
npx @graphforge/cli install-skill --agent opencode
```

Manual Studio launch opens a Project Hub. Agent launch opens the generated `.ogdoc` directly.

## Agent Workflow

The installed skill should:

1. Inspect the app framework, routes, metadata, brand assets, screenshots, and copy.
2. Ask only relevant design questions: strategy, pages, tone, source mode, references, and output format.
3. Create a durable session.
4. Generate an editable `.ogdoc` at `.graphforge/sessions/<id>/document.ogdoc`.
5. Validate the document.
6. Launch Studio.
7. Wait for the next Studio decision.

```bash
graphforge session create --repo . --agent codex --strategy hybrid --mode template
graphforge document validate --source ".graphforge/sessions/<id>/document.ogdoc"
graphforge session launch --repo . --id "<id>" --open true --waitReady true --json
graphforge session wait --repo . --id "<id>" --until next-action --timeout 0
```

When `next-action` returns:

- `agent-requested`: read `agent-request.json`, revise `document.ogdoc`, validate, relaunch Studio, and wait again.
- `published`: read confirmed `publish-request.json`, then wire metadata into the app.
- `cancelled` or `terminal`: stop without mutating metadata.

## Session Files

Each session is recoverable from:

```text
.graphforge/sessions/<id>/
  session.json
  events.jsonl
  document.ogdoc
  incoming/
  export.json
  publish-request.json
  agent-request.json
  studio.json
```

These files are the cross-agent contract. If an agent process stops, rerun the skill and resume from the session files.

## Studio Features

- State-aware Project Hub for direct CLI launch, repo launch, recovery, and recent documents.
- Layered Konva canvas for text, image, logo, screenshot, shape, badge, and background layers.
- Image upload, crop, focal point, fit mode, and asset packaging.
- Typography controls for font, size, weight, style, color, line height, letter spacing, stroke, and stroke width.
- Shape controls for fill, border, radius, opacity, rotation, skew, align, distribute, snap, duplicate, lock, hide, reorder, and delete.
- Effect controls for supported glow, shadow, blur, gradient, noise, lighting, vignette, and blend modes.
- Platform preview inspector for X/Twitter, LinkedIn, Facebook, Discord, Slack, WhatsApp, iMessage, and browser/search.
- Export to exact `1200x630` PNG, WebP, JPEG, or SVG source.

Unsupported effect/layer combinations are hidden or disabled instead of shown as fake-functional controls.

## Export And Publish

Default final output:

```bash
graphforge export --project project.og.json --format png --out public/og.png
```

Optional formats:

```bash
graphforge export --project project.og.json --format webp --quality 82 --out public/og.webp
graphforge export --project project.og.json --format jpg --quality 82 --out public/og.jpg
graphforge render --project project.og.json --out public/og.svg
```

Publish flow:

```bash
graphforge publish --preview --repo . --session "<id>" --framework next --image public/og.png
graphforge publish --confirm --repo . --session "<id>" --framework next --image public/og.png
```

Preview writes a handoff request only. Confirm writes metadata and preserves backups where applicable.

## Package Layout

- `packages/core`: schema, presets, validation, platform warnings, effect capabilities, document package support.
- `packages/render`: SVG renderer and PNG/WebP/JPEG export pipeline.
- `packages/studio`: React/Vite creative-tool interface.
- `packages/cli`: local CLI, Studio server, sessions, packaging, skill install, publish helpers.
- `packages/codex-skill` and `packages/cli/codex-skill`: bundled agent skill source and packaged copy.
- `scripts`: workflow, package, handoff, and Studio smoke tests.

## Quality Gate

Before release or claiming a workflow is fixed:

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
npm pack -w @graphforge/cli --dry-run
```

Smoke coverage verifies npx-style packaging, skill install, session handoff, Studio startup, browser interaction, platform preview layout, export dimensions, nonblank raster output, and no provider-key requirement.

## Boundaries

- GraphForge coordinates agent workflows; it does not generate images through provider APIs.
- Studio is an OG finishing tool, not a full general-purpose design suite.
- Platform previews are careful local simulations. Deployed URLs should still be checked with live social validators before launch.
- Dynamic framework metadata may require manual review even after GraphForge writes a safe preview or confirmed handoff.
