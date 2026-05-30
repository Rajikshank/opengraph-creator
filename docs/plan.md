# OpenGraph Creator Product Architecture

OpenGraph Creator is a local, agent-neutral Open Graph finishing studio. A coding agent generates an editable `.ogdoc` document for a user's app. Studio edits, previews, exports, and writes recovery/handoff files. The agent then resumes and wires metadata only after user confirmation.

## Non-Negotiables

- Local-first v1: no hosted backend is required.
- Provider-neutral: OpenGraph Creator does not require OpenAI, Anthropic, or image-provider keys.
- Agent-first generation: Codex, Claude Code, OpenCode, or another coding agent performs repo inspection and asset creation.
- Document-first editing: `.ogdoc` is the master source of truth.
- File-based bridge: `.opengraph-creator/sessions/<id>/` is the recovery and handoff contract.
- Preview-first publish: no target app metadata changes without explicit confirmation.

## Primary Flow

1. Agent skill inspects the target repo.
2. Agent asks only relevant design questions.
3. Agent creates `.opengraph-creator/sessions/<id>/`.
4. Agent generates `document.ogdoc` with editable layers.
5. Agent validates the document and launches Studio.
6. Studio edits the document, previews platform crops, and exports the final `1200x630` image.
7. Studio writes `agent-request.json` or confirmed `publish-request.json`.
8. Agent waits with `opengraph-creator session wait --until next-action`.
9. Agent resumes from session files and publishes only after confirmation.

## Direct CLI Launch

`opengraph-creator studio` opens the Project Hub.

`opengraph-creator studio --repo <path>` opens a repo-scoped hub with:

- no-active-agent state
- open `.ogdoc`
- start manual draft
- recent documents
- provider-neutral agent connection recipe

Direct launch must not load a generic template unless the user explicitly starts a manual draft.

## Document Model

`.ogdoc` is a lightweight package that contains:

- editable project JSON
- packaged assets
- source artifact records
- recovery metadata

Flat SVG, PNG, JPEG, WebP, HTML, and JSON files are import/export formats. They are not the default editable session master.

## Studio Editing Contract

Studio supports editable text, image, logo, screenshot, shape, badge, and background layers. Every enabled control must serialize to `.ogdoc` and render through export.

Supported v1 effect policy:

- background, shape, image, logo, screenshot: gradient, noise, lighting, vignette, blur, shadow, glow
- text, badge: blur, shadow, glow
- group effects: deferred until group rendering is implemented

Unsupported effect/layer combinations must be hidden or disabled. Do not show fake controls.

## Effect Parity Contract

The same saved document state must drive:

1. Konva editing canvas
2. platform preview
3. SVG/raster export

Implementation rules:

- Preview/export use the SVG renderer as the source of truth.
- Canvas may use Konva-specific implementation details, but it must stay visually honest.
- Blur uses actual Konva filtering with cache invalidation, not shadow approximation.
- Noise, lighting, vignette, glow, and shadows must stay within their intended layer bounds.
- Browser smoke must test live effect changes before effect work is considered complete.

## History And Recovery

- Undo/redo uses bounded in-memory history.
- Redo clears after any new edit.
- Keyboard shortcuts ignore input fields and contenteditable areas.
- Session files remain the durable recovery path.
- Error toasts must be normalized into human-readable messages with recovery guidance.
- Self-healing may retry, preserve current state, keep inline assets, or expose recovery commands.
- Self-healing must not auto-publish, silently flatten `.ogdoc`, or overwrite metadata.

## Preview And Export

Platform preview is a first-class inspector surface. It should simulate the important layout behavior of each platform while keeping stable frame bounds and owned scroll regions.

Final raster exports must be:

- exact `1200x630`
- nonblank
- optimized for the selected PNG, WebP, or JPEG format
- written to the chosen target path

SVG remains useful for source/export workflows, but PNG is the default metadata-safe output.

## Release Gate

Before release:

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

The package must prove the CLI binary, bundled Studio assets, bundled skill files, local workspace dependencies, npx/global install path, session handoff, browser Studio flow, platform preview layout, export quality, and provider-neutral behavior.
