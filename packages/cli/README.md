# OpenGraph Creator

OpenGraph Creator is an agent-first Open Graph image studio and CLI for app repositories.

Coding agents such as Codex, Claude Code, and OpenCode generate editable `.ogdoc` documents. OpenGraph Creator Studio opens those documents, lets users edit visually, previews platform crops, exports optimized `1200x630` assets, and writes handoff files so the agent can wire metadata into the target app after confirmation.

OpenGraph Creator does not call OpenAI, Anthropic, or image-generation providers directly.

## Install The Skill

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y
```

## Run The Studio

```bash
npx -y opengraph-creator@latest studio --repo .
```

## Check The Runtime

```bash
npx -y opengraph-creator@latest doctor --json
```

## Repository

Full documentation and source:

https://github.com/Rajikshank/opengraph-creator
