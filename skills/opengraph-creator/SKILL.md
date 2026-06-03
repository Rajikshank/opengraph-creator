---
name: opengraph-creator
description: Use when Codex, Claude Code, or OpenCode needs to create, revise, preview, export, or wire editable Open Graph images, social previews, per-page OG images, or .ogdoc Studio documents for an app, website, route, page, launch, blog post, SaaS project, or local repo.
metadata:
  opengraph_creator_skill_version: 0.1.8
---

# OpenGraph Creator

OpenGraph Creator is a local Open Graph finishing studio. The coding agent generates an editable OG document, Studio lets the user finish it visually, and the agent wires the confirmed export into the target app. OpenGraph Creator does not call image providers itself and must not require OpenAI, Anthropic, or other provider API keys.

Use the `opengraph-creator` CLI. If no local binary exists, run the public runtime through `npx -y opengraph-creator@latest`.

## Distribution Contract

This skill is installed through the skills ecosystem, for example `npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y` for all supported local agents. Do not ask the user to separately run `opengraph-creator install-skill` in normal setup. The fallback installer exists only for local development or recovery when the skills CLI cannot be used or when an agent-specific install must be repaired.

## Update And Doctor

Use the skills CLI for the skill and npm for the Studio runtime. The Studio runtime may relaunch itself through `npx -y opengraph-creator@latest` when a newer runtime exists. The skill instructions must not be silently updated inside an active task because the running agent may already have loaded the old instructions.

1. Check updates with `opengraph-creator update check --json` or `npx -y opengraph-creator@latest update check --json`.
2. If the report says the skill is stale or missing, stop the OG task and tell the user to run `npx skills check -g opengraph-creator`, then `npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y`, then `npx -y opengraph-creator@latest doctor --json`.
3. Tell the user to start a new agent session after updating the skill. Do not continue the current generation flow with stale skill instructions.
4. If only the Studio runtime is outdated, it may auto-refresh through `npx -y opengraph-creator@latest`; continue after the refreshed runtime starts.
5. If the doctor reports a missing agent skill, prefer reinstalling from the skill repo with `npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y`; use the fallback installer only for local repair, for example `opengraph-creator install-skill --agent opencode --scope global` or `opengraph-creator install-skill --agent all --scope global`.
6. Do not clone or build the OpenGraph Creator source repo for normal users.

## Non-Negotiable Editable Master Rule

Always create an editable `.ogdoc` master document. The `.ogdoc` package is the PSD-style source of truth: it stores editable document JSON, packaged assets, previews, and recovery metadata.

Do not bake headline, subtitle, badge, route, CTA, logo text, or important layout objects into one flat SVG/image. Generated images, SVG snippets, HTML captures, screenshots, logos, textures, and fantasy backgrounds may be used only as source assets inside the editable `.ogdoc`, with text and main composition layers editable above or around them.

Never invent custom `ogcreator://` URLs for generated art, emblems, screenshots, SVGs, HTML captures, or images. Internal `ogcreator://` URLs are reserved for built-in Studio placeholders only. Generated assets must be actual editable layers, packaged `assets/*.svg` / `assets/*.png` / `assets/*.webp` files, or inline `data:image/svg+xml` / image data URLs that `opengraph-creator document validate` can verify.

Pure-image fallback is allowed only when the user explicitly asks for a flat image after being warned that it reduces Studio editability. Do not offer pure image as a normal first-choice path.

## Mandatory State Machine

Follow this state machine exactly:

`inspect_repo -> question_gate -> reference_research -> concept_thesis -> style_thesis -> write_generation_brief -> create_session -> generate_editable_ogdoc -> validate_document -> launch_studio -> wait_next_action -> handle_restart_revision_or_publish -> apply_metadata_after_confirmation`

Do not skip the Question Gate. Do not create a session, document, image, SVG, HTML, or launch Studio before the Question Gate is complete. Do not end the chat after launch. The agent task remains active while Studio is open.

## Hard Stop: Capability And Question Gate

Inspect the repo and current agent capabilities first, then ask concise designer-style questions. Stop and wait for answers if any required answer is missing. A vague prompt such as "create me an electrifying OG image" is not permission to generate immediately.

Before asking visual questions, record the capability gate in the generation brief:

- `imageGeneration`: whether this agent has a real image-generation tool available in the current environment.
- `webReferenceResearch`: whether this agent can browse/search for reference direction.
- `svgGeneration`: whether this agent can write SVG/vector assets.
- `htmlGeneration`: whether this agent can write HTML/CSS source assets.
- `repoAssetAccess`: whether this agent can inspect local screenshots, logos, copy, metadata, and product UI.
- `studioRuntime`: whether this agent can run `opengraph-creator` and launch Studio.

Do not assume image generation exists. If `imageGeneration` is unavailable, say that this agent cannot create new raster art in the current environment and ask whether SVG/vector, HTML/CSS, screenshot, logo, icon, and repo-asset composition is acceptable. If `imageGeneration` is available and the user permits it, use it only for non-text assets while keeping main text editable. If capability is unknown, ask one short capability question before offering image-heavy directions.

Ask these decisions before generation:

1. Coverage: one common OG for the whole app, page-specific OG images, or a hybrid?
2. Asset strategy: which visual parts should be editable text/shapes/effects, SVG/vector assets, repo screenshots/assets, generated non-text image assets if available, or a flexible per-asset mix? Always keep the final master as editable `.ogdoc`.
3. Asset permission: if this agent has image-generation tools, may it use them for non-text assets such as backgrounds, product scenes, textures, lighting, or illustrations? If it does not, ask whether a non-image-generation path is acceptable instead of implying generated art is available.
4. Visual direction: what mood should it carry, such as premium, electrifying, cinematic, minimal, playful, futuristic, luxury, brutalist, or another direction?
5. Reference inputs: any reference image, screenshot, logo, brand asset, color direction, or example OG style to follow?
6. Pages/routes: which routes should be covered, or should the agent infer the important pages from the app?
7. Final export: default is optimized 1200x630 PNG; should Studio also export WebP, JPEG, or SVG?

Only treat the Question Gate as complete when the user explicitly answers these decisions in the current task or directly relevant earlier answers. If the user says "you decide", choose conservatively from repo evidence and record that decision in the brief.

Write the resolved answers into `.opengraph-creator/sessions/<id>/generation-brief.json` after session creation. The brief must record `capabilities`, `coverage`, `assetStrategy`, `assetPermission`, `visualDirection`, `references`, `targetPages`, `exportFormats`, `referenceResearch`, `conceptThesis`, `styleThesis`, `semanticPalette`, `compositionPlan`, `compositionArchetype`, structured `assetPlan`, `recipeSelection`, `libraryPlan`, `noisePolicy`, `texturePolicy`, `negativeDirection`, `routeVariantRules`, and any assumptions.

## Reference Research, Concept Thesis, And Style Thesis

After the Question Gate and before creating the session document, run a short Reference Research phase:

- Inspect local screenshots, logos, route copy, existing metadata, product language, colors, and UI surfaces.
- If web/search tools are available and useful, gather mood/composition references only. Do not copy protected internet reference assets, brand imagery, illustrations, screenshots, or layouts into the `.ogdoc` unless the user provided them or license/permission is clear.
- Record source names/URLs or local paths as reference notes, not as hidden dependencies.
- For page-specific or hybrid OGs, identify what each route should visually communicate while preserving one shared system.

Then write a Concept Thesis:

- Name one visual metaphor tied to the app domain, page purpose, or user outcome. Do not use generic energy, sparkle, orbit, blob, or dashboard decoration unless it clearly explains the product.
- Define a semantic palette: each color must have a role, such as brand anchor, data signal, warning, editorial paper, depth shadow, or action highlight.
- Decide which 2-4 visual objects carry the concept, such as a route map, signal beam, publication spread, product window, data trail, layered document, or crafted emblem.
- State why every large shape exists. If a shape has no job, remove it before packing the `.ogdoc`.

Then write a Style Thesis:

- State the intended visual character in one or two concrete sentences.
- Define the composition plan and composition archetype: hierarchy, focal asset, text zones, safe-zone behavior, and page-variant rhythm. Choose the archetype from the app/page evidence rather than reusing a default OpenGraph Creator layout.
- Read `references/asset-strategy-router.md`, choose a recipe from `references/recipes/`, and define the structured asset plan: which generated images, SVG/HTML captures, screenshots, textures, lighting, or references become editable asset layers.
- Noise, grain, and texture are opt-in. Set `noisePolicy` or `texturePolicy` to `allowed` only if the user explicitly requests it or a provided reference clearly depends on it; otherwise do not add `effects.noise` to generated layers.
- Define the negative direction: what the design must avoid, including generic AI dashboard styling, flat baked text, copied references, unreadable detail, or disconnected variants.
- Define routeVariantRules for common, page-specific, or hybrid output.
- Do not repeat the previous OpenGraph Creator structure, grid, badge placement, or left-text/right-art formula unless this is a recovery task or the user explicitly asks to preserve that direction.
- Read `references/visual-generation-guide.md` and `references/asset-strategy-router.md` before generating SVG, HTML, image, screenshot, or mixed visual assets. Use the guide to choose the best path for the current capabilities; no-image agents should produce strong SVG/HTML/repo-asset compositions rather than weak fake image art.

### Required First Response Example

If the user says: "create me an electrifying OG image"

Do not generate. Ask:

> I can do that, but I need the OG direction first so the Studio document stays editable. Do you want one OG for the whole app or page-specific OGs? Should the design be mostly editable vector/layout layers, or can I generate dramatic non-text image assets for the background/art while keeping text editable? Any reference image or brand direction I should follow?

Then wait.

## Studio Wait Loop

This wait command is mandatory after Studio launch and after every agent revision or restart:

```bash
opengraph-creator session wait --repo "<repo>" --id "<id>" --until next-action --timeout 0
```

If the command returns `agent-requested`, inspect `pendingAction`:

- `agent-restart-from-question-gate`: keep the same session alive, ask the Question Gate again, generate a fresh editable `.ogdoc`, validate, relaunch Studio, and wait again. Do not treat restart as terminal.
- `agent-revise-document`: revise the editable `.ogdoc`, validate, relaunch Studio, and wait again.
- Any other agent request: read `agent-request.json`, satisfy the request inside the editable `.ogdoc`, validate, relaunch Studio, and wait again.

If the command returns `published`, read `publish-request.json`, verify the request is confirmed, preview metadata changes, and apply only after explicit user confirmation. If it returns `cancelled` or `terminal`, stop without mutating app metadata.

## Manual Studio Attach Flow

If Studio was opened manually or the user already has a Studio project or `.ogdoc` open, do not start a disconnected generation flow and do not add UI controls. Use the backend attach command to attach this already-open Studio work to a durable session:

```bash
opengraph-creator session attach --repo "<repo>" --project "<project-id-or-ogdoc>" --agent codex --launch true --wait true
```

Use `--agent codex` in Codex, `--agent claude` in Claude Code, and `--agent opencode` in OpenCode. The attach command must create `.opengraph-creator/sessions/<id>/document.ogdoc`, launch or reuse Studio when requested, and wait for the next Studio decision. After attach, follow the same wait loop as the normal generated-session flow. Do not finish the chat until the attached session returns `published`, `agent-requested`, `cancelled`, or `terminal`.

## Workflow

1. Run `opengraph-creator doctor --json`. If `opengraph-creator` is not available, use `npx -y opengraph-creator@latest doctor --json`, or run `node scripts/ensure-opengraph-creator.mjs` for local install guidance. Do not clone or build the Studio repo for normal user runtime.
2. Inspect the repo for framework, routes, metadata files, brand assets, screenshots, copy, product tone, and existing OG metadata.
3. Complete the Hard Stop Capability And Question Gate and wait for missing answers.
4. Run the Reference Research, Concept Thesis, and Style Thesis phases. Read `references/asset-strategy-router.md`, select the nearest recipe in `references/recipes/`, and record `referenceResearch`, `conceptThesis`, `styleThesis`, `semanticPalette`, `compositionPlan`, structured `assetPlan`, `recipeSelection`, `libraryPlan`, `negativeDirection`, and `routeVariantRules`.
5. Create a durable session with the current agent name, for example `opengraph-creator session create --repo "<repo>" --agent opencode --strategy hybrid --mode template`. Use `--agent codex` in Codex, `--agent claude` in Claude Code, and `--agent opencode` in OpenCode.
6. Run `opengraph-creator brief --repo "<repo>" --name "<app>" --strategy common|pages|hybrid --mode template --out ".opengraph-creator/brief.json"` and write the resolved question gate answers plus research/thesis fields into `.opengraph-creator/sessions/<id>/generation-brief.json`.
   - Validate the brief before asset generation: `opengraph-creator brief lint --source ".opengraph-creator/sessions/<id>/generation-brief.json" --repo "<repo>" --id "<id>"`.
   - Validate the asset route before document generation: `opengraph-creator assets lint --brief ".opengraph-creator/sessions/<id>/generation-brief.json" --repo "<repo>" --id "<id>"`.
7. Generate the OG source as an editable `.ogdoc` package. The document must contain separate layers for text, badges, shapes, screenshots, logos, generated art, SVG/HTML source assets, references, and backgrounds.
   - If the user chooses page-specific or hybrid, generate one `.ogdoc` with internal page variants, not disconnected documents per route.
   - Every page variant must keep a shared visual system while changing route-specific text, badges, image context, and focal motif.
   - If image generation tools are available and allowed, use them only for non-text asset layers unless the user explicitly requested pure-image fallback.
8. If raw project JSON is generated first, pack it with `opengraph-creator document pack --project "<project.json>" --out ".opengraph-creator/sessions/<id>/document.ogdoc"`, then delete or ignore the temporary JSON. If SVG/image/HTML assets were generated, import or package them as assets inside the document. Do not use invented `ogcreator://` asset URLs; use real `assets/*` entries, data URLs, or editable vector/shape layers.
9. Validate with `opengraph-creator document validate --source ".opengraph-creator/sessions/<id>/document.ogdoc"`, then `opengraph-creator design lint --source ".opengraph-creator/sessions/<id>/document.ogdoc" --repo "<repo>" --id "<id>"`, then `opengraph-creator render check --source ".opengraph-creator/sessions/<id>/document.ogdoc" --repo "<repo>" --id "<id>"`. If validation fails because important text is baked into one SVG/image, regenerate editable layers. If any gate fails, read `.opengraph-creator/sessions/<id>/generation-errors.jsonl`, fix the brief or document, and rerun the gate.
10. Launch Studio with `opengraph-creator session launch --repo "<repo>" --id "<id>" --open true --waitReady true --json`. This is mandatory; do not wait for the user to ask again.
11. Wait while the user edits with `opengraph-creator session wait --repo "<repo>" --id "<id>" --until next-action --timeout 0`.
12. If interrupted, resume from `session.json`, `events.jsonl`, `document.ogdoc`, `generation-brief.json`, `export.json`, `agent-request.json`, and `publish-request.json`; continue from the latest `pendingAction`.
13. Export optimized PNG/WebP/JPEG/SVG from Studio or with the CLI only after the user chooses export.
14. Preview publishing before metadata changes.
15. Publish/wire metadata only after explicit confirmation.
16. On confirmed publish, wire every page image mapping from `publish-request.json`; do not wire only the first page when the document is page-specific or hybrid.

## Handoff Rules

- For Studio-to-agent requests, read `agent-request.json`, update the editable `.ogdoc`, validate, relaunch Studio, and wait again.
- The handoff is for Codex, Claude, or OpenCode to generate or revise assets. Do not make OpenGraph Creator call an AI provider.
- Use session files for recovery: `session.json`, `events.jsonl`, `incoming/`, `document.ogdoc`, `generation-brief.json`, `export.json`, `agent-request.json`, and `publish-request.json`.
- Prefer recovery from `document.ogdoc`; `project.og.json` is legacy fallback only.
- Read `references/agent-handoff.md` when a revision or generation handoff is needed.
- Read `references/agent-waiting.md` before deciding whether to keep waiting, recover, restart, revise, or resume publishing.
- Read `references/project-schema.md` before producing editable OpenGraph Creator JSON.
- Read `references/visual-generation-guide.md` before generating SVG, HTML, image, screenshot, or mixed visual assets.
- Read `references/asset-strategy-router.md` before deciding asset media or fallbacks.
- Read one matching `references/recipes/*.md` file before choosing the composition archetype.
- Read `references/metadata-apply.md` before applying metadata.

## Safety

- Always preview before applying metadata.
- Never replace app metadata without preview and user confirmation.
- Preserve backups on confirmed apply.
- Keep key text inside the 64px safe zone.
- Prefer editable layers for headline, subtitle, badge, logo, screenshots, references, shapes, and background.
- Generated asset layers can be fantasy, cinematic, grand, or image-rich when the user wants that direction, but important text and layout controls must remain editable in Studio.
