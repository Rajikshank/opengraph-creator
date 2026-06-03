# OpenGraph Creator

Agent-first Open Graph image creation for real app repositories.

[![npm version](https://img.shields.io/npm/v/opengraph-creator.svg)](https://www.npmjs.com/package/opengraph-creator)
[![license](https://img.shields.io/badge/license-MIT-111827.svg)](LICENSE)

OpenGraph Creator pairs a coding agent with a local visual Studio. The agent understands your app, creates an editable `.ogdoc` Open Graph document, launches Studio, waits while you edit, then wires the confirmed export back into your project.

OpenGraph Creator does not call OpenAI, Anthropic, or image-generation providers directly. Generation belongs to the coding agent. Studio handles editing, preview, export, compression, recovery, and publish handoff.

![OpenGraph Creator Studio preview](assets/studio-preview.png)

## Why It Exists

Most OG generators create a flat image. That is fast, but it is hard to revise: text gets baked in, page variants drift, and the final metadata step still has to be wired by hand.

OpenGraph Creator keeps the source editable:

- Agents create layered `.ogdoc` documents instead of one-off flat images.
- Studio gives users a visual editor for text, images, shapes, effects, previews, and export.
- The file bridge lets Codex, Claude Code, or OpenCode resume after the user edits.
- Final metadata changes happen only after an explicit publish handoff.

## Quick Start

Install the public skill for all supported local coding agents:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y
```

Check that the runtime is available:

```bash
npx -y opengraph-creator@latest doctor --json
```

Open your app in Codex, Claude Code, or OpenCode and ask for an editable Open Graph image. The installed skill should inspect the repo, ask the relevant design questions, generate a layered `.ogdoc`, open Studio, and wait for your publish decision.

## Install For One Agent

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent codex -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent claude-code -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent opencode -y
```

For selected agents, repeat the agent flag:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator -a codex -a opencode -y
```

## Run Studio Directly

Studio can also be opened without an active agent session:

```bash
npx -y opengraph-creator@latest studio --repo .
```

Manual launch opens the Project Hub. Agent launch opens the generated session document directly.

## Workflow

OpenGraph Creator uses a durable local session:

```text
.opengraph-creator/sessions/<id>/
  session.json
  events.jsonl
  generation-brief.json
  document.ogdoc
  incoming/
  export.json
  publish-request.json
  agent-request.json
  studio.json
```

Typical flow:

1. The skill inspects framework, routes, metadata, brand assets, screenshots, and copy.
2. The agent asks only relevant designer-style questions.
3. The agent writes a controlled generation brief and creates an editable `.ogdoc`.
4. Quality gates reject baked text, missing layers, weak asset routing, or broken renderer output.
5. Studio opens with the generated document.
6. The user edits, previews platform crops, exports, or requests an agent revision.
7. Studio writes a confirmed publish request.
8. The agent wires the final image paths into the target app after confirmation.

## The `.ogdoc` Format

`.ogdoc` is the editable source of truth. It packages:

- project JSON
- layers and page variants
- source assets
- previews
- recovery metadata

Flat PNG, WebP, JPEG, SVG, HTML, and JSON files can be imported as assets or exported as final output, but they do not replace `.ogdoc` unless the user explicitly chooses a pure-image fallback.

## Studio Capabilities

- Text, image, logo, screenshot, shape, badge, and background layers.
- Image upload, replacement, crop, focal point, fit mode, and asset packaging.
- Font family, weight, style, size, color, line height, letter spacing, stroke, and stroke width.
- Fill, border, radius, opacity, rotation, skew, perspective, snapping, and transforms.
- Blur, shadow, glow, gradient, noise/grain, lighting, vignette, blend modes, and advanced effect stacks where supported.
- Layer select, reorder, hide, lock, duplicate, delete, align, and distribute.
- Undo and redo with bounded history.
- Platform previews for X/Twitter, LinkedIn, Facebook, Discord, Slack, WhatsApp, iMessage, and browser/search.
- Export to exact `1200x630` PNG, WebP, JPEG, SVG, and layered PSD source export.

Unsupported layer/effect combinations are disabled or hidden instead of shown as fake controls.

## Generation Quality Gates

The skill and CLI use validation steps before Studio launch:

```bash
opengraph-creator brief lint --source ".opengraph-creator/sessions/<id>/generation-brief.json" --repo . --id "<id>"
opengraph-creator assets lint --brief ".opengraph-creator/sessions/<id>/generation-brief.json" --repo . --id "<id>"
opengraph-creator document validate --source ".opengraph-creator/sessions/<id>/document.ogdoc"
opengraph-creator design lint --source ".opengraph-creator/sessions/<id>/document.ogdoc" --repo . --id "<id>"
opengraph-creator render check --source ".opengraph-creator/sessions/<id>/document.ogdoc" --repo . --id "<id>"
```

When run inside a session, failed checks append recovery details to `generation-errors.jsonl` so the agent can repair the brief or document and continue.

## Agent Handoff

After Studio opens, the agent should keep waiting:

```bash
opengraph-creator session wait --repo . --id "<id>" --until next-action --timeout 0
```

Possible next actions:

- `agent-requested`: Studio asks the agent to revise the editable `.ogdoc`.
- `published`: Studio has exported and confirmed publish handoff files.
- `cancelled` or `terminal`: no metadata changes should be made.

Preview requests are not publish approval. Metadata is changed only after confirmed handoff.

## Privacy And Boundaries

- No provider API keys are required by Studio.
- Studio does not call AI providers.
- Metadata is never changed by Studio alone.
- Session files stay local in the target repo.
- Platform previews are local simulations; deployed URLs should still be checked with live social validators before launch.

## Updating

Check runtime and skill freshness:

```bash
npx -y opengraph-creator@latest update check --json
```

OpenGraph Creator can relaunch the Studio runtime through `npx -y opengraph-creator@latest` when a newer runtime is available.

Skill updates are manual because the running coding agent may already have loaded the old instructions. If the update check reports a stale skill, stop the current OG task, run:

```bash
npx skills check
npx skills update
npx -y opengraph-creator@latest doctor --json
```

Then start a new agent session.

## Troubleshooting

If the runtime is missing, run:

```bash
npx -y opengraph-creator@latest doctor --json
```

If one agent cannot see the skill, reinstall for that agent:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent opencode -y
```

The runtime also includes a fallback repair installer for local recovery:

```bash
opengraph-creator install-skill --agent all --scope global
```

Normal setup should use `npx skills add`.

## Repository Layout

- `skills/opengraph-creator`: public skill source for Codex, Claude Code, and OpenCode.
- `packages/cli`: runtime CLI, Studio server, sessions, validation gates, packaging, and publish handoff.
- `packages/studio`: React/Vite Studio interface.
- `packages/core`: `.ogdoc` schema, document validation, effects, and project helpers.
- `packages/render`: SVG renderer and raster export pipeline.
- `scripts`: workflow, package, handoff, agent, and Studio smoke tests.

Generated package outputs such as `packages/cli/bundled-skill` and `packages/cli/studio-dist` are build artifacts and are not committed source.

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
npm run smoke:workflow
npm run smoke:agent-handoff
npm run smoke:agent-next-action
npm run smoke:package
npm run smoke:studio
```

## License

MIT
