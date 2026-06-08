# Project Schema Notes

OpenGraph Creator projects are 1200x630 editable OG documents.

The primary delivery artifact is `.ogdoc`, a proprietary Studio document package. It contains `manifest.json`, `document.json`, package assets, previews, and exports. Agents should generate `.ogdoc` as the master file, not a flat SVG/image.

Important fields:

- `strategy`: `common`, `pages`, or `hybrid`
- `generationMode`: `template` by default. Use `pure-image` only after explicit user request and an editability warning.
- `targetPages`: route list
- `activePageId`: selected page variant inside Studio, when the strategy is `pages` or `hybrid`
- `pages`: editable internal page variants stored inside the same `.ogdoc`; each entry has `route`, `title`, `description`, `exportPath`, `status`, `layers`, and `sourceContext`
- `sharedDesign`: short description of the common visual system that all page variants should preserve
- `sourceArtifacts`: generated source files from Codex, Claude, manual import, or library
- `layers`: editable background, text, badge, shape, image, logo, screenshot, imported source, or group layers

When generating editable JSON:

- Keep major design parts as separate layers.
- Keep text editable.
- Keep generated image, SVG, and HTML work as asset/reference layers inside `.ogdoc`; do not use them as the master source.
- For `pages` and `hybrid`, create one `.ogdoc` with page variants inside `pages`; do not create unrelated separate master documents for each route.
- Preserve the shared design across every page variant while changing route-specific headline, description, badge, imagery, and `exportPath`.
- Use `sourceContext` to record the route file, detected title, detected description, and confidence so the agent can recover and explain why each page image exists.
- Use placeholder images when the final asset is not available yet.
- Include source artifacts for SVG, HTML, image, or generated JSON inputs.
- Do not flatten the design unless the user explicitly requested pure image fallback after the editability warning.
- Use image generation tools only for background/art/texture/product-scene assets in editable mode.
- Reject or regenerate any template-mode output that contains only one full-canvas SVG/image layer with baked text.

`generation-brief.json` should record:

- `coverage`: `common`, `pages`, or `hybrid`
- `capabilities`: image generation, web reference research, SVG, HTML, repo access, and Studio runtime availability
- `assetStrategy`: editable text/shapes/effects, SVG/vector assets, repo screenshots/assets, generated non-text image assets if available, or a flexible per-asset mix
- `assetPermission`: whether available image generation tools may be used for non-text assets
- `visualDirection`: mood and style words from the user
- `references`: paths, URLs, or notes for reference images/assets
- `referenceResearch`: local and optional web/reference notes used for mood and composition, never copied assets
- `conceptThesis`: the domain-specific visual metaphor and why large objects exist
- `styleThesis`: concise visual point of view for the OG system
- `semanticPalette`: named color roles, not random colors
- `compositionPlan`: hierarchy, safe-zone, focal asset, text zones, and page rhythm
- `compositionPlanV2`: strict design contract with `version`, `appName`, `strategy`, `capabilityGate`, `brandEvidence`, `referenceResearch`, `conceptThesis`, `styleThesis`, role-based `semanticPalette`, `compositionArchetype`, `focalHierarchy`, `assetStrategy`, `effectsPlan`, `negativeDirection`, and `qualityChecklist`
- `assetPlan`: structured per-asset route with role, medium, fallbacks, reason, textPolicy, editableOverlayLayers, validation, and requiredEvidence
- `recipeSelection`: selected recipe id, reason, requiredEvidence, and antiSlopRules
- `libraryPlan`: authoring/reference libraries allowed as adapters, plus forbidden runtime changes
- `noisePolicy` and `texturePolicy`: `allowed`, `disallowed`, or `unknown`; generated noise defaults to disallowed
- `negativeDirection`: explicit design and safety constraints to avoid generic, copied, flattened, or unreadable output
- `routeVariantRules`: how page-specific or hybrid variants preserve one shared system while changing route context
- `targetPages`: user-selected or inferred routes
- `exportFormats`: requested final formats, defaulting to optimized 1200x630 PNG
- `assumptions`: agent decisions when the user says "you decide"

`.opengraph-creator/brand/` should record durable design evidence:

- `brand.json`: local app name, framework, brand assets, route evidence, reference notes, blocked motifs, and required layer policies
- `style-notes.md`: human-readable local brand notes for future agent sessions
- `references/`: user-provided or local reference notes/assets only
- `approved-assets/`: assets the user or repo clearly permits
- `composition-history.json`: recent recipe/archetype choices so fresh generations avoid repeating the same structure

When publishing page-specific work, read `publish-request.json` and wire every `pageImages` entry to the matching route metadata after the user confirms the handoff.

When the session is restarted, read `generation-brief.json` only as archived context. A restart with `pendingAction: "agent-restart-from-question-gate"` means ask the Question Gate again before producing a new `.ogdoc`.
