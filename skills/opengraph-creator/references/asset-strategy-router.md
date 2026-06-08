# Asset Strategy Router

Use this router after the Question Gate, Reference Research, Concept Thesis, and Style Thesis. The goal is not to choose one global format. Choose the strongest medium per asset, then pack everything into the editable `.ogdoc` master.

## Router Contract

Each planned asset must record:

- `role`: what job it does in the design.
- `medium`: the first-choice source form.
- `fallbacks`: safer alternatives if the first medium cannot be generated or validated.
- `reason`: why this asset belongs in this concept.
- `textPolicy`: `editable-required`, `no-important-text-baked`, `decorative-text-only`, or `pure-image-explicit`.
- `editableOverlayLayers`: which Studio layers keep the result editable.
- `validation`: checks that must pass before Studio launch.
- `requiredEvidence`: repo facts, user answers, references, or assumptions that justify it.

## Medium Selection

- Use `ogdoc-text` for headline, subtitle, badge, CTA, route labels, logo text, and any text the user may edit.
- Use `ogdoc-shape` for frames, dividers, masks, cards, lines, background blocks, safe-zone structure, and simple semantic geometry.
- Use `ogdoc-effect` for serialized glow, shadow, blur, lighting, vignette, and optional texture. Do not fake effects with baked image pixels when Studio supports the effect.
- Use `svg` for precise decorative motifs, emblems, data marks, route maps, and icon-like art that can be audited in code.
- Use `d3-svg` or `visx` only when data or network structure is the concept.
- Use `repo-screenshot` when the app UI itself is the proof.
- Use `repo-asset` for existing logos, product images, screenshots, and approved local art.
- Use `image-generation` only when the current agent has a real image-generation tool and the user permits non-text raster art.
- Use `react-satori-svg` as an optional authoring adapter for static SVG assets, not as the master document.
- Use `react-playwright-capture` only for non-text visual assets that need browser CSS fidelity. Do not add this as a normal runtime requirement.
- Use `placeholder` only when the asset cannot be produced yet; name it clearly so Studio users can replace it.

## Reject Rules

Regenerate or reroute the asset if:

- Important text is baked into SVG, HTML, screenshot, generated image, or full-card raster.
- The asset is a full 1200x630 image in template mode without editable text and badge layers above it.
- The concept thesis cannot explain why a large shape exists.
- The design uses generic blobs, orbits, sparkles, glow fog, or dashboard panels without a product-specific job.
- The same OpenGraph Creator layout formula is reused for a fresh generation without user approval.
- Noise or grain appears while `noisePolicy` is not `allowed`.
- A third-party/reference asset is copied without user-provided source or clear permission.

## Validation Sequence

After writing `generation-brief.json`, run:

```bash
opengraph-creator brief lint --source ".opengraph-creator/sessions/<id>/generation-brief.json" --repo "<repo>" --id "<id>"
opengraph-creator assets lint --brief ".opengraph-creator/sessions/<id>/generation-brief.json" --document ".opengraph-creator/sessions/<id>/document.ogdoc" --repo "<repo>" --id "<id>"
```

After writing `document.ogdoc`, run:

```bash
opengraph-creator document validate --source ".opengraph-creator/sessions/<id>/document.ogdoc"
opengraph-creator design lint --source ".opengraph-creator/sessions/<id>/document.ogdoc" --repo "<repo>" --id "<id>"
opengraph-creator render check --source ".opengraph-creator/sessions/<id>/document.ogdoc" --repo "<repo>" --id "<id>"
```

If any command fails, read `.opengraph-creator/sessions/<id>/generation-errors.jsonl`, fix the brief or document, and rerun the failed gate.
