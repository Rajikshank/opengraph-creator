# GraphForge Product And Architecture Plan

GraphForge is a local, agent-neutral Open Graph finishing studio. It installs as a CLI/skill workflow, receives editable `.ogdoc` documents from a user's coding agent, lets the user refine the design in Studio, exports optimized OG images, and hands confirmed publish work back to the agent.

## Product Position

- Agent-first: Codex, Claude Code, OpenCode, or another coding agent is responsible for repo inspection and source generation.
- Studio-first for editing: GraphForge owns visual editing, platform preview, export quality, and recovery files.
- Local-first: no hosted backend is required for v1.
- Provider-neutral: no OpenAI, Anthropic, or image-provider key is required by GraphForge.
- Document-first: `.ogdoc` is the editable source of truth.

## Primary Flow

1. Agent skill inspects the target repo.
2. Agent asks relevant setup questions.
3. Agent creates `.graphforge/sessions/<id>/`.
4. Agent generates `document.ogdoc` with editable layers.
5. Agent launches Studio.
6. Studio edits and exports the final `1200x630` image.
7. Studio writes `agent-request.json` or confirmed `publish-request.json`.
8. Agent waits with `graphforge session wait --until next-action`.
9. Agent resumes from session files and publishes only after confirmation.

## Direct CLI Launch

`graphforge studio` opens a local Project Hub.

`graphforge studio --repo <path>` opens a repo-scoped hub with:

- no-active-agent state
- open `.ogdoc`
- start manual draft
- recent documents
- provider-neutral agent connection recipe

Direct launch must not load a generic template unless the user explicitly starts a manual draft.

## Editing Scope

Studio supports editable text, image, logo, screenshot, shape, badge, and background layers. Controls must serialize into the document and render in export. Unsupported effect/layer combinations must be hidden or disabled rather than shown as working controls.

Supported v1 effect policy:

- background/shape/image/logo/screenshot: gradient, noise, lighting, vignette, blur, shadow, glow
- text/badge: blur, shadow, glow
- group: no direct effects until group rendering is implemented

## Preview And Export

Platform preview uses the same SVG renderer as export so supported effects stay in sync. Konva remains the interactive editing canvas.

Final raster exports must be exact `1200x630`, nonblank, and suitable for OG metadata. PNG is the default. WebP and JPEG are optional compressed outputs. SVG is source/export support, not the default metadata image.

## Release Gate

Before release:

```bash
npm run build
npm test
npm run typecheck
npm run lint
npm run smoke:workflow
npm run smoke:agent-handoff
npm run smoke:package
npm run smoke:studio
npm pack -w @graphforge/cli --dry-run
```

The package must include the CLI binary, bundled Studio assets, bundled skill files, and local workspace dependencies required for npx/global usage.
