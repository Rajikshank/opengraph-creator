# Visual Generation Guide

Use this guide before creating SVG, HTML, image, screenshot, or mixed visual assets for an OpenGraph Creator `.ogdoc`.

## Capability Gate

First record what the current agent can actually do:

- `imageGeneration`: can create raster artwork with an image-generation tool.
- `webReferenceResearch`: can browse/search for mood and composition references.
- `svgGeneration`: can write valid SVG or vector-like JSON layers.
- `htmlGeneration`: can write HTML/CSS source assets or screenshotable compositions.
- `repoAssetAccess`: can inspect local logos, screenshots, product UI, icons, copy, and metadata.
- `studioRuntime`: can run `opengraph-creator` CLI commands and launch Studio.

Ask the user only for choices that can be honored with those capabilities. If `imageGeneration` is false, do not ask as if generated art is available. State the limitation plainly, then ask whether an SVG/vector, HTML/CSS, screenshot, or repo-asset composition is acceptable instead. If `imageGeneration` is unknown, ask one short capability question before promising image-heavy art.

## Capability-Aware Question Router

Use this router before the normal design questions:

- If `imageGeneration` is true: ask whether generated non-text raster assets are allowed, then offer image-rich, SVG/vector, HTML/CSS, screenshot, or mixed paths.
- If `imageGeneration` is false: do not offer generated images. Ask whether the user wants SVG/vector illustration, HTML/CSS composition, product screenshot composition, existing brand assets, or a mixed no-image path.
- If `webReferenceResearch` is false: ask for any reference image or style words from the user, then build from repo evidence instead of claiming current internet references.
- If `repoAssetAccess` is false: ask for screenshots, logos, copy, routes, and brand colors before generating.
- If `studioRuntime` is false: still generate a valid `.ogdoc`, but explain that Studio launch must be done by a capable environment or with `npx -y opengraph-creator@latest`.

The goal is not to reduce creativity. The goal is to choose the strongest creative path the current agent can actually execute.

## Capability-Based Creative Paths

### With image generation

Use image generation only for non-text assets:

- atmospheric backgrounds
- product scenes
- cinematic textures
- abstract-but-meaningful visual metaphors
- illustrations without baked headline/subtitle/badge text

Keep headline, subtitle, route labels, badges, CTAs, logos, and key layout objects as editable `.ogdoc` layers.

### Without image generation

Create a strong visual system from:

- clean SVG geometry
- HTML/CSS panels rendered or imported as source assets
- repo screenshots and product UI captures
- logos, icons, screenshots, and brand colors found in the app
- gradients, lighting, grain, shadows, vignettes, and depth effects represented as editable layers
- typography and composition rather than fake illustration

Do not compensate for missing image generation by adding random blobs, arbitrary polygons, meaningless waves, or decorative clutter.

### SVG-only path

Use SVG assets for purposeful, editable-looking graphics:

- data trails for analytics products
- route maps for navigation/search products
- cards, windows, terminals, documents, grids, or timelines for software products
- clean symbols related to the page content
- layered frames and light geometry that support the text hierarchy

Avoid huge opaque full-canvas SVGs with baked text. If an SVG is imported into `.ogdoc`, it should usually be a background, illustration, or texture layer with editable text above it.

### HTML/CSS path

Use HTML/CSS assets when layout precision is more important than illustration:

- product dashboard snapshots
- browser windows
- code/editor panels
- app UI mock surfaces
- publication/editorial cards
- pricing/product comparison surfaces

Keep text that the user should edit as `.ogdoc` text layers, not only HTML text inside a flat capture.

## Visual Taste Rules

Design one clear visual thesis. The viewer should understand the page or product direction within one second.

Prefer:

- restrained graphite, off-black, warm white, amber, blue-gray, moss, oxide, ink, clay, and one strong accent
- confident whitespace and a clear focal region
- large readable type, fewer words, strong line breaks
- meaningful shapes tied to the app domain
- texture at low opacity, clipped to its intended layer
- one or two lighting moves, not a glow everywhere
- page variants that share a system but change their route-specific content

Avoid:

- generic purple-blue AI gradients unless the user explicitly asks for that style
- muddy brown/green accidents from unplanned palettes
- rainbow neon palettes without a reason
- low contrast text
- tiny decorative details that disappear in platform previews
- meaningless abstract blobs, random circles, random triangles, and disconnected wave paths
- visual metaphors that do not match the page context
- fake UI controls that imply features not present in the app
- flat full-canvas screenshots with no hierarchy
- copied internet reference art or brand assets without permission

## Composition Checklist

Every OG should have:

- canvas size `1200x630`
- 64px safe zone for key text and logo
- one primary headline zone
- one supporting subtitle or context zone
- one product/page signal, such as route badge, icon, screenshot, illustration, or content motif
- one brand signal, such as logo, app name, or distinctive palette
- background depth that does not compete with text
- enough contrast to read at thumbnail size

Use scale intentionally:

- headline is the largest readable element
- subtitle is secondary and shorter
- badges and metadata are tertiary
- background art is supportive unless the user explicitly requested a highly visual card

## Page Variant Rules

For per-page or hybrid OGs:

- use one shared grid, palette, and type rhythm
- change route-specific badge, headline, subtitle, and focal motif
- avoid each page looking like a different product
- avoid only changing text while leaving irrelevant artwork unchanged
- preserve export paths and page mappings for every route

## Self-Critique Before Validation

Before packing the `.ogdoc`, check:

1. Would the design still make sense if the headline were hidden?
2. Would the image still read at 300px wide?
3. Are all important words editable text or badge layers?
4. Are generated/SVG/HTML assets only supporting the editable design?
5. Are shapes meaningful to the product or page?
6. Is the palette intentional and limited?
7. Are safe-zone edges respected?
8. Does the platform preview crop preserve the focal idea?
9. Is every layer named clearly enough for a user to edit?
10. Does `opengraph-creator document validate` pass?

If any answer is no, revise the `.ogdoc` before launching Studio.
