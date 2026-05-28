# GraphForge Agent Instructions

## Product Truth

GraphForge is an agent-first Open Graph finishing studio. Codex, Claude, or OpenCode generates OG source assets for the user's app. Studio imports those assets, edits them visually, previews platform crops, exports optimized OG images, and writes handoff files so the coding agent can wire the final image into the target app.

GraphForge does not call AI image providers and must not require OpenAI, Anthropic, or other provider API keys.

The current working architecture is document-first. The primary editable source is the proprietary `.ogdoc` Studio document package, which stores the editable project JSON plus packaged assets and recovery metadata. Flat SVG, HTML, PNG, JPEG, and WebP files may be imported as assets or exported as final output, but they must not replace `.ogdoc` as the session master file unless the user explicitly chooses pure-image fallback.

## Protected Baseline

The current agent-to-studio workflow is a protected baseline and must not be interrupted, replaced, or simplified without a concrete product reason, explicit user approval, and passing regression coverage.

The protected flow is:

1. The installed skill asks only relevant designer-style questions.
2. The coding agent creates a durable session.
3. The coding agent generates editable layered `.ogdoc` content by default.
4. The coding agent launches Studio automatically with the generated document.
5. Studio opens the generated `.ogdoc`, lets the user edit layers, and saves back into the same session document.
6. Studio exports optimized 1200x630 OG images into the target app repo.
7. Studio writes `export.json` and `publish-request.json` so the coding agent can resume, preview, and wire metadata after user confirmation.

Future fixes should preserve this path first. UI, canvas, effects, import, export, and publish changes must be tested against this flow before completion.

## Required Workflow

When working on GraphForge itself:

1. Preserve the `npx` install and launch path.
2. Keep the v1 bridge file-based and fault tolerant.
3. Prefer editable `.ogdoc` documents with separate layers over flat images when an agent can produce layers.
4. Never replace target app metadata without preview and explicit user confirmation.
5. Keep the Studio usable without an active agent session.
6. Treat `.graphforge/sessions/<id>/` files as recovery state.

When the GraphForge Skill is invoked inside a user app:

1. Inspect the repo for framework, routes, brand assets, screenshots, copy, and existing OG metadata.
2. Ask only relevant setup questions:
   - common, per-page, or hybrid OG strategy
   - editable `.ogdoc`, hybrid `.ogdoc` with generated asset layers, or pure image source
   - desired visual tone
   - target pages
   - inspiration/reference images if useful
3. Create a durable session with `graphforge session create`.
4. Generate the editable master document at `.graphforge/sessions/<id>/document.ogdoc`; put supporting assets in `.graphforge/sessions/<id>/incoming/` or inside the document package.
5. Validate the document with `graphforge document validate --source ".graphforge/sessions/<id>/document.ogdoc"`.
6. Open Studio with `graphforge session launch --repo "<repo>" --id "<id>" --open true --waitReady true --json`.
7. Wait for the next Studio decision with `graphforge session wait --repo "<repo>" --id "<id>" --until next-action --timeout 0`.
8. If the wait returns `agent-requested`, read `agent-request.json`, revise `document.ogdoc`, validate, relaunch Studio, and wait again. If it returns `published`, read confirmed `publish-request.json` and wire metadata. If it returns `cancelled` or `terminal`, stop without metadata mutation.
9. Resume from `session.json`, `events.jsonl`, `document.ogdoc`, `export.json`, `publish-request.json`, and `agent-request.json` if interrupted.
10. Publish only after preview and user confirmation.

## UI And UX Rules

- Build a professional creative-tool interface, not a marketing dashboard.
- Use calm matte graphite chrome, warm neutral canvas surfaces, and one restrained bright accent.
- Do not use the old green theme.
- Do not add shiny AI gradients, decorative filler, vague labels, or fake controls.
- Every visible control must work or be disabled with a clear reason.
- Canvas editing space is the priority.
- Layers must be visible, understandable, and scrollable.
- Avoid body-level desktop scrolling; use owned panel scroll regions.
- Platform preview must feel like a precise inspector surface, not a card wall below the canvas.
- Use lucide icons for tool actions and tooltips for icon-only controls.
- Keep cards to individual repeated items, modals, or actual framed tools.

## Frontend Implementation Rules

- Use the frontend design and layout skills before major UI changes.
- Use shadcn/Radix-style primitives where useful: resizable panels, scroll area, toolbar, tooltip, tabs, slider, switch, select, dialog/sheet, and sonner toasts.
- Trace height constraints before changing layout:
  - shell gets full viewport height
  - flex/grid scroll children get `min-height: 0`
  - fixed bars get `shrink: 0`
  - scroll containers get explicit dimensions
- Use stable dimensions for canvas, toolbar, icon buttons, layer rows, and preview frames.
- Test desktop and mobile layouts with Playwright screenshots after significant UI work.

## Editing Requirements

Studio must support:

- add/edit text, image, shape, badge, and background layers
- image upload and replacement
- real image rendering in the canvas
- crop, focal point, and fit mode
- font family, weight, style, size, color, line height, and letter spacing
- fill, border, radius, opacity, rotation, skew/perspective
- glow, shadow, blur, gradient, noise/grain, lighting, vignette, and blend mode
- align, distribute, snap, duplicate, lock, hide, reorder, and delete

Konva handles editing interactions. The GraphForge renderer remains the export source of truth, so every supported Studio edit must serialize and export correctly.

## Canvas, Preview, And Export Parity

GraphForge has three visual surfaces: Studio canvas, platform preview, and export. Do not change one surface without proving the other two still reflect the same `.ogdoc` state.

- Preview and export use the GraphForge SVG renderer as the source of truth.
- Canvas uses Konva for interaction and must stay visually honest with the renderer.
- Blur must use a real canvas filter with cache invalidation. Do not approximate blur with shadow props.
- Glow, shadow, noise, lighting, and vignette must remain clipped to the intended layer or rendered asset bounds.
- Effects work is incomplete until browser smoke proves live canvas changes and platform preview/export SVG changes.
- If an effect cannot be represented on a layer type, disable or hide that control instead of showing a fake-functional UI.

## History And Fault Tolerance

- Undo/redo must use bounded history so slider and transform edits do not grow memory without limit.
- Redo history must clear after a new edit.
- Keyboard shortcuts must ignore text inputs, textareas, selects, and contenteditable fields.
- Error toasts must use Studio error normalization with a recovery action. Do not show raw stack text or unexplained HTTP codes as the primary message.
- Safe self-healing may retry, preserve in-memory state, keep inline assets, or show recovery commands. It must not auto-publish, silently flatten `.ogdoc`, or overwrite target app metadata.

## Tool Surface Rules

- Object creation belongs to the canvas tool palette.
- The layer panel manages existing layers only: select, reorder, hide, lock, duplicate, delete, align, and distribute.
- Do not reintroduce duplicate add buttons in the layer panel unless the product explicitly changes the tool model and browser smoke is updated.

## Verification Gates

Before claiming completion, run and inspect:

- `npm run build`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run smoke:workflow`
- `npm run smoke:agent-handoff`
- `npm run smoke:agent-next-action`
- `npm run smoke:package`
- `npm run smoke:studio`
- `npm pack -w @graphforge/cli --dry-run`

Also verify:

- no provider-key requirement remains
- no default generic template loads on normal startup
- no button click refreshes the UI
- platform previews use the current rendered image
- blur, glow, noise, lighting, and vignette update live where supported
- undo/redo works through toolbar controls and keyboard shortcuts
- only one object creation toolbar is visible
- exported PNG/WebP/JPEG are exactly `1200x630`
- exported raster output is nonblank
- visual screenshots show no horizontal overflow or broken scrollbars
