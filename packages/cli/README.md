# OpenGraph Creator

OpenGraph Creator is an agent-first Open Graph image studio and CLI for app repositories.

Coding agents such as Codex, Claude Code, and OpenCode generate editable `.ogdoc` documents. OpenGraph Creator Studio opens those documents, lets users edit visually, previews platform crops, exports optimized `1200x630` assets, and writes handoff files so the agent can wire metadata into the target app after confirmation.

OpenGraph Creator does not call OpenAI, Anthropic, or image-generation providers directly. Generation belongs to the coding agent; Studio owns editing, preview, export, compression, recovery, and handoff.

## Install Skill

Install the skill for all supported local agents:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y
```

Then verify the runtime:

```bash
npx -y opengraph-creator@latest doctor --json
```

## Run Studio

Open Studio directly from an app repo:

```bash
npx -y opengraph-creator@latest studio --repo .
```

Manual launch opens the Project Hub. Agent launch opens the generated session document directly.

## Agent Workflow

After the skill is installed, open your app in Codex, Claude Code, or OpenCode and ask for an editable Open Graph image.

The installed skill should:

1. Inspect the app routes, brand assets, copy, screenshots, and existing metadata.
2. Ask only the relevant design questions.
3. Create a durable `.opengraph-creator/sessions/<id>/` session.
4. Generate an editable layered `.ogdoc` document.
5. Launch Studio with that document.
6. Wait for Studio to request a revision, publish, cancel, or restart.
7. Wire metadata only after the user confirms publish.

## Manual Launch

Use manual launch when you want to open existing `.ogdoc` files, import generated assets, or inspect a repo without an active agent session:

```bash
npx -y opengraph-creator@latest studio --repo .
```

## Update

Update installed skills:

```bash
npx skills check
npx skills update
```

The Studio runtime uses the latest npm package when invoked with:

```bash
npx -y opengraph-creator@latest doctor --json
```

## Troubleshooting

If the skill cannot find the runtime, run:

```bash
npx -y opengraph-creator@latest doctor --json
```

If an agent-specific skill install needs repair:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent codex -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent claude-code -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent opencode -y
```

## Repository

Full documentation and source:

https://github.com/Rajikshank/opengraph-creator
