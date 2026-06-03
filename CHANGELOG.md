# Changelog

## Unreleased

### Added

- Added a controlled generation pipeline for agent-created Open Graph documents:
  - capability gate fields in generation briefs
  - concept thesis, semantic palette, recipe selection, and structured asset planning
  - asset strategy router and recipe references for stronger non-generic visual direction
- Added generation quality commands:
  - `opengraph-creator brief lint`
  - `opengraph-creator assets lint`
  - `opengraph-creator design lint`
  - `opengraph-creator render check`
- Added agent-readable recovery logging through `generation-errors.jsonl` when lint/check commands run with session context.
- Added tests for structured generation briefs, no-baked-text rules, design linting, render checks, and public skill source coverage.

### Changed

- Renamed the generated npm fallback skill copy from `codex-skill` to `bundled-skill` to better reflect Codex, Claude Code, and OpenCode support.
- Kept legacy `codex-skill` lookup compatibility for older local builds and packages.
- Updated README and npm README with the generation quality gate flow.

### Verified

- `npm run build`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run smoke:workflow`
- `npm run smoke:agent-handoff`
- `npm run smoke:agent-next-action`
- `npm run smoke:package`
- `npm run smoke:studio`
- `npm pack -w opengraph-creator --dry-run`

## 0.1.7

### Added

- Added agent-first `.ogdoc` Studio workflow, npx runtime packaging, skill installation support, session handoff files, platform previews, optimized export, and Studio browser smoke coverage.
