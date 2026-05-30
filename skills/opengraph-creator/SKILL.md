---
name: opengraph-creator
description: Use when Codex, Claude Code, or OpenCode needs to create, revise, preview, export, or wire editable Open Graph images, social previews, per-page OG images, or .ogdoc Studio documents for an app, website, route, page, launch, blog post, SaaS project, or local repo.
---

# OpenGraph Creator

OpenGraph Creator is a local Open Graph finishing studio. The coding agent generates an editable OG document, Studio lets the user finish it visually, and the agent wires the confirmed export into the target app. OpenGraph Creator does not call image providers itself and must not require OpenAI, Anthropic, or other provider API keys.

Use the `opengraph-creator` CLI. If no local binary exists, run the public runtime through `npx -y opengraph-creator@latest`.

## Distribution Contract

This skill is installed through the skills ecosystem, for example `npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator -y`. Do not ask the user to separately run `opengraph-creator install-skill` in normal setup. The fallback installer exists only for local development or recovery when the skills CLI cannot be used or when an agent-specific install must be repaired.

## Update And Doctor

Use the standard skills updater for the skill and npm for the Studio runtime:

1. Check the installed skill with `npx skills check`.
2. Update installed skills with `npx skills update`.
3. Check the Studio runtime with `opengraph-creator doctor --json` or `npx -y opengraph-creator@latest doctor --json`.
4. If the doctor reports a missing agent skill, prefer reinstalling from the skill repo with `npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator -y`; use `opengraph-creator install-skill --agent codex|claude-code|opencode --scope global` only as a local repair fallback.
5. Do not clone or build the OpenGraph Creator source repo for normal users.

## Non-Negotiable Editable Master Rule

Always create an editable `.ogdoc` master document. The `.ogdoc` package is the PSD-style source of truth: it stores editable document JSON, packaged assets, previews, and recovery metadata.

Do not bake headline, subtitle, badge, route, CTA, logo text, or important layout objects into one flat SVG/image. Generated images, SVG snippets, HTML captures, screenshots, logos, textures, and fantasy backgrounds may be used only as source assets inside the editable `.ogdoc`, with text and main composition layers editable above or around them.

Pure-image fallback is allowed only when the user explicitly asks for a flat image after being warned that it reduces Studio editability. Do not offer pure image as a normal first-choice path.

## Mandatory State Machine

Follow this state machine exactly:

`inspect_repo -> question_gate -> reference_research -> style_thesis -> write_generation_brief -> create_session -> generate_editable_ogdoc -> validate_document -> launch_studio -> wait_next_action -> handle_restart_revision_or_publish -> apply_metadata_after_confirmation`

Do not skip the Question Gate. Do not create a session, document, image, SVG, HTML, or launch Studio before the Question Gate is complete. Do not end the chat after launch. The agent task remains active while Studio is open.

## Hard Stop: Question Gate

Inspect the repo first, then ask concise designer-style questions. Stop and wait for answers if any required answer is missing. A vague prompt such as "create me an electrifying OG image" is not permission to generate immediately.

Ask these decisions before generation:

1. Coverage: one common OG for the whole app, page-specific OG images, or a hybrid?
2. Visual build style: mostly editable vector/layout layers, generated image assets under editable layers, SVG/HTML source assets inside `.ogdoc`, or a flexible mix?
3. Asset permission: may the agent use available image-generation tools for non-text assets such as backgrounds, fantasy art, product scenes, textures, lighting, or illustrations?
4. Visual direction: what mood should it carry, such as premium, electrifying, cinematic, minimal, playful, futuristic, luxury, brutalist, or another direction?
5. Reference inputs: any reference image, screenshot, logo, brand asset, color direction, or example OG style to follow?
6. Pages/routes: which routes should be covered, or should the agent infer the important pages from the app?
7. Final export: default is optimized 1200x630 PNG; should Studio also export WebP, JPEG, or SVG?

Only treat the Question Gate as complete when the user explicitly answers these decisions in the current task or directly relevant earlier answers. If the user says "you decide", choose conservatively from repo evidence and record that decision in the brief.

Write the resolved answers into `.opengraph-creator/sessions/<id>/generation-brief.json` after session creation. The brief must record `coverage`, `visualBuildStyle`, `assetPermission`, `visualDirection`, `references`, `targetPages`, `exportFormats`, `referenceResearch`, `styleThesis`, `compositionPlan`, `assetPlan`, `negativeDirection`, `routeVariantRules`, and any assumptions.

## Reference Research And Style Thesis

After the Question Gate and before creating the session document, run a short Reference Research phase:

- Inspect local screenshots, logos, route copy, existing metadata, product language, colors, and UI surfaces.
- If web/search tools are available and useful, gather mood/composition references only. Do not copy protected internet reference assets, brand imagery, illustrations, screenshots, or layouts into the `.ogdoc` unless the user provided them or license/permission is clear.
- Record source names/URLs or local paths as reference notes, not as hidden dependencies.
- For page-specific or hybrid OGs, identify what each route should visually communicate while preserving one shared system.

Then write a Style Thesis:

- State the intended visual character in one or two concrete sentences.
- Define the composition plan: hierarchy, focal asset, text zones, safe-zone behavior, and page-variant rhythm.
- Define the asset plan: which generated images, SVG/HTML captures, screenshots, textures, lighting, or references become editable asset layers.
- Define the negative direction: what the design must avoid, including generic AI dashboard styling, flat baked text, copied references, unreadable detail, or disconnected variants.
- Define routeVariantRules for common, page-specific, or hybrid output.

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

## Workflow

1. Run `opengraph-creator doctor --json`. If `opengraph-creator` is not available, use `npx -y opengraph-creator@latest doctor --json`, or run `node scripts/ensure-opengraph-creator.mjs` for local install guidance. Do not clone or build the Studio repo for normal user runtime.
2. Inspect the repo for framework, routes, metadata files, brand assets, screenshots, copy, product tone, and existing OG metadata.
3. Complete the Hard Stop Question Gate and wait for missing answers.
4. Run the Reference Research and Style Thesis phases. Record `referenceResearch`, `styleThesis`, `compositionPlan`, `assetPlan`, `negativeDirection`, and `routeVariantRules`.
5. Create a durable session with `opengraph-creator session create --repo "<repo>" --agent codex|claude|opencode --strategy common|pages|hybrid --mode template`.
6. Run `opengraph-creator brief --repo "<repo>" --name "<app>" --strategy common|pages|hybrid --mode template --out ".opengraph-creator/brief.json"` and write the resolved question gate answers plus research/thesis fields into `.opengraph-creator/sessions/<id>/generation-brief.json`.
7. Generate the OG source as an editable `.ogdoc` package. The document must contain separate layers for text, badges, shapes, screenshots, logos, generated art, SVG/HTML source assets, references, and backgrounds.
   - If the user chooses page-specific or hybrid, generate one `.ogdoc` with internal page variants, not disconnected documents per route.
   - Every page variant must keep a shared visual system while changing route-specific text, badges, and image context.
   - If image generation tools are available and allowed, use them only for non-text asset layers unless the user explicitly requested pure-image fallback.
8. If raw project JSON is generated first, pack it with `opengraph-creator document pack --project "<project.json>" --out ".opengraph-creator/sessions/<id>/document.ogdoc"`, then delete or ignore the temporary JSON. If SVG/image/HTML assets were generated, import or package them as assets inside the document.
9. Validate with `opengraph-creator document validate --source ".opengraph-creator/sessions/<id>/document.ogdoc"`. If validation fails because important text is baked into one SVG/image, regenerate editable layers.
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
- Read `references/metadata-apply.md` before applying metadata.

## Safety

- Always preview before applying metadata.
- Never replace app metadata without preview and user confirmation.
- Preserve backups on confirmed apply.
- Keep key text inside the 64px safe zone.
- Prefer editable layers for headline, subtitle, badge, logo, screenshots, references, shapes, and background.
- Generated asset layers can be fantasy, cinematic, grand, or image-rich when the user wants that direction, but important text and layout controls must remain editable in Studio.
