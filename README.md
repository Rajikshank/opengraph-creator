# GraphForge OG Studio

Agent-first Open Graph finishing studio for local app repositories. Codex, Claude, OpenCode, or another coding agent generates the OG source artifact; GraphForge imports it, lets a human edit and preview it, exports optimized social images, and prepares safe publish handoff plans.

GraphForge does not require an OpenAI key and does not call image-generation providers from the app, CLI, Studio, or skill.

## What Works In This V1

- Create editable OG project JSON for common, page-specific, or hybrid strategies.
- Import agent-generated GraphForge JSON, SVG, HTML, or image assets into the Studio.
- Create local agent handoff plans for template-based or pure-image generation.
- Edit text, font, image, shape, layout, blur, glow, shadow, gradient, noise, lighting, and opacity settings.
- Preview the same OG image across X/Twitter, LinkedIn, Facebook, Discord, Slack, WhatsApp, iMessage, and browser/search contexts.
- Export default raster `public/og.png`, optional `public/og.webp` or `public/og.jpg`, and SVG source/template files.
- Manage durable `.graphforge/sessions/<id>/` handoff files for agent recovery.
- Run a local Studio with resizable panels, owned scroll regions, layer creation, inspector controls, image upload, direct canvas movement, duplicate/delete, lock/unlock, hide/show, undo/redo, and platform previews.
- Scan common web app frameworks and preview/apply basic metadata files.
- Preserve existing HTML/Vite, Next.js, Astro, Nuxt, and Remix files through conservative metadata upserts or merges.
- Install the bundled Codex skill into a local skills directory.

## Commands

```bash
npm install
npm run build
npm run graphforge -- doctor
npm run graphforge -- doctor --json
npm run graphforge -- brief --repo . --name "My App" --strategy hybrid --mode template --out .graphforge/brief.json
npm run graphforge -- new --name "My App" --strategy hybrid --mode template --pages /,/pricing --out my-app.og.json
npm run graphforge -- import --source .graphforge/generated/og.svg --kind svg --name "My App" --out my-app.imported.og.json
npm run graphforge -- variants --project my-app.og.json --outDir .graphforge
npm run graphforge -- render --project my-app.og.json --out public/og.svg
npm run graphforge -- export --project my-app.og.json --format png --out public/og.png
npm run graphforge -- export --project my-app.og.json --format jpg --quality 82 --out public/og.jpg
npm run graphforge -- agent-handoff --project my-app.og.json --prompt "make it feel like a polished product launch" --out public/og-agent.png --plan .graphforge/agent-handoff.json
npm run graphforge -- session create --repo . --agent codex --strategy hybrid --mode template
npm run graphforge -- publish --preview --session <id> --image public/og.png
npm run graphforge -- publish --confirm --session <id> --image public/og.png
npm run graphforge -- studio --port 5123
```

After publishing as an npm package, the target entrypoint is:

```bash
npx @graphforge/cli doctor
npx @graphforge/cli studio
npx @graphforge/cli install-skill --agent codex
```

## Codex Skill

Install the bundled skill for Codex, Claude, OpenCode, or all supported local agent folders:

```bash
npm run graphforge -- install-skill --agent codex
npm run graphforge -- install-skill --agent claude
npm run graphforge -- install-skill --agent opencode
npm run graphforge -- install-skill --agent all
```

The skill teaches the coding agent to inspect the repo, choose common/page/hybrid generation, choose template or pure-image mode, generate editable assets, open the Studio for review, export optimized images, and preview metadata changes before applying them.

`graphforge doctor` verifies the CLI, renderer, bundled Studio assets, bundled skill source, local skill installation, and agent handoff readiness.

## Agent Handoff Flow

Use `brief` when you want a durable handoff between an app repo and Codex, Claude, or OpenCode:

```bash
npm run graphforge -- brief --repo . --name "My App" --strategy pages --mode template --reference references/og-style.png --out .graphforge/brief.json
```

The brief contains detected framework, routes, metadata files, brand assets, selected common/page-specific/hybrid strategy, selected template or pure-image mode, optional reference image path, and a strict output contract for editable GraphForge JSON, SVG/HTML, or pure 1200x630 image output.

Then ask the coding agent to generate the source artifact, import it into the Studio, review/edit/export the final image, and run `graphforge publish --preview` before any metadata mutation. Confirmed publishes create `.graphforge.bak` backups first.

## Pure Image Mode

Use this when the user chooses a flat generated bitmap instead of an editable template/layer design:

```bash
npm run graphforge -- agent-handoff --project my-app.og.json --prompt "cinematic but minimal SaaS launch card" --out public/og-agent.png --plan .graphforge/agent-handoff.json
```

The command writes an agent handoff plan only. The coding agent generates or authors the image outside GraphForge and returns the result to Studio for preview, compression, export, and metadata wiring.

`graphforge agent-image` and `graphforge ai-image` are kept only as compatibility aliases for the same local handoff behavior.

## Package Layout

- `packages/core`: schema, presets, validation, platform rules, route variants.
- `packages/render`: SVG rendering plus PNG/WebP/JPEG export.
- `packages/cli`: local commands, repo scan, session workflow, library, Studio server, metadata publish, skill install.
- `packages/studio`: React/Vite editor.
- `packages/codex-skill`: source skill instructions and references.

## Verification

Run the full local gate:

```bash
npm test
npm run typecheck
npm run build
npm run lint
npm audit --audit-level=moderate
npm run smoke:workflow
npm run smoke:studio
npm run smoke:package
npm run smoke:agent-handoff
npm pack -w @graphforge/cli --dry-run
```

`npm run smoke:workflow` uses the built CLI against a temporary app repo and verifies doctor, brief creation, editable project creation, page variants, optimized WebP export, mutation-free metadata preview, confirmed metadata apply, and agent handoff planning.

`npm run smoke:studio` starts the built local Studio, verifies the import-first editor UI renders, performs real save/handoff/export/drag interactions, rejects legacy visual tokens in the served CSS, checks compact viewport overflow, and writes desktop/compact screenshot artifacts to `.tmp-smoke/studio-visual/`.

`npm run smoke:package` packs the core, render, and CLI workspaces, installs those tarballs into a temporary app, then runs the installed `graphforge` binary to create and render an OG project. This verifies the npx-style packaged path outside the monorepo.

The CLI package bundles `studio-dist` and `codex-skill`, so `npx @graphforge/cli studio` can serve the editor and `graphforge install-skill --agent codex|claude|opencode|all` can install the agent workflow without requiring a monorepo checkout.

## Current Boundaries

- GraphForge coordinates coding agents; it is not an AI provider client.
- Metadata application is intentionally conservative and file-based. Deeply dynamic framework metadata may still require manual review after the preview step.
- Platform previews are approximations; final live URL preview should still be checked after deployment.
- The Studio is a focused OG finishing tool, not a full general-purpose design suite.
